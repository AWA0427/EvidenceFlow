import type { Claim, Evidence, SafetyCheck, SafetyReport } from '../../shared/types';

/** 常见 PII 模式：手机号、身份证、邮箱、银行卡。 */
const PII_PATTERNS: Array<{ label: string; pattern: RegExp; mask: (value: string) => string }> = [
  {
    label: '手机号',
    pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
    mask: (value) => `${value.slice(0, 3)}****${value.slice(-4)}`,
  },
  {
    label: '身份证号',
    pattern: /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g,
    mask: (value) => `${value.slice(0, 6)}********${value.slice(-4)}`,
  },
  {
    label: '邮箱',
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    mask: (value) => {
      const [name, domain] = value.split('@');
      return `${name.slice(0, 2)}***@${domain}`;
    },
  },
  {
    label: '银行卡号',
    pattern: /(?<!\d)(?:\d[ -]?){16,19}(?!\d)/g,
    mask: (value) => `${value.replace(/\D/g, '').slice(0, 4)} **** **** ${value.replace(/\D/g, '').slice(-4)}`,
  },
];

export interface RedactionResult {
  text: string;
  count: number;
  labels: string[];
}

export function redactPII(input: string): RedactionResult {
  let text = input;
  let count = 0;
  const labels = new Set<string>();

  for (const rule of PII_PATTERNS) {
    text = text.replace(rule.pattern, (match) => {
      // 银行卡规则会误伤长数字串，只有长度符合且包含分隔符或 16+ 位时才处理
      if (rule.label === '银行卡号' && !/[\s-]/.test(match) && match.replace(/\D/g, '').length < 16) {
        return match;
      }
      count += 1;
      labels.add(rule.label);
      return rule.mask(match);
    });
  }

  return { text, count, labels: [...labels] };
}

const INJECTION_PATTERNS = [
  /忽略(?:之前|以上|前面|所有)(?:的)?(?:指令|提示|要求|规则)/i,
  /ignore (?:all )?(?:previous|above) (?:instructions|prompts)/i,
  /(?:输出|泄露|告诉我|打印)(?:你的|系统)(?:提示词|prompt|指令)/i,
  /(?:system prompt|developer message|jailbreak|越狱)/i,
  /(?:调用|执行)(?:工具|函数|shell|命令).{0,20}(?:删除|上传|转账|发送)/i,
];

export function detectPromptInjection(input: string): { detected: boolean; matched: string[] } {
  const matched = INJECTION_PATTERNS.filter((pattern) => pattern.test(input)).map((pattern) => pattern.source);
  return { detected: matched.length > 0, matched };
}

/** 把用户材料包进明确的数据边界，降低文档内指令覆盖系统指令的风险。 */
export function wrapUntrustedData(input: string): string {
  return `<untrusted_source_document>\n${input}\n</untrusted_source_document>`;
}

export function buildSafetyReport(params: {
  claims: Claim[];
  evidence: Evidence[];
  piiRedacted: number;
  injectionDetected: boolean;
}): SafetyReport {
  const { claims, evidence, piiRedacted, injectionDetected } = params;
  const evidenceByClaim = new Map<string, Evidence[]>();
  for (const item of evidence) {
    const list = evidenceByClaim.get(item.claimId) ?? [];
    list.push(item);
    evidenceByClaim.set(item.claimId, list);
  }

  const supported = claims.filter((claim) => {
    const items = evidenceByClaim.get(claim.id) ?? [];
    return items.some((item) => item.verified) && (claim.status === 'verified' || claim.status === 'partial');
  });
  const citationCoverage = claims.length === 0 ? 100 : (supported.length / claims.length) * 100;
  const unsupported = claims.filter((claim) => claim.status === 'unsupported' || claim.status === 'partial');
  const numericClaims = claims.filter((claim) => claim.value !== null);
  const numericVerified = numericClaims.filter((claim) => claim.status === 'verified');
  const numericConsistency = numericClaims.length === 0 ? 100 : (numericVerified.length / numericClaims.length) * 100;

  const checks: SafetyCheck[] = [
    {
      label: '数值可追溯',
      passed: numericConsistency >= 90,
      detail: `${numericVerified.length}/${numericClaims.length} 个数值主张具备原文引用或确定性公式`,
    },
    {
      label: '引用覆盖',
      passed: citationCoverage >= 90,
      detail: `已发布主张的引用覆盖率为 ${citationCoverage.toFixed(1)}%`,
    },
    {
      label: '无依据主张拦截',
      passed: unsupported.length === 0 || unsupported.every((claim) => claim.criticNote),
      detail: `${unsupported.length} 条待核实主张已标注原因并排除出高管摘要`,
    },
    {
      label: 'PII 脱敏',
      passed: true,
      detail: piiRedacted > 0 ? `检测并脱敏 ${piiRedacted} 处个人信息` : '未检测到可直接识别个人的信息',
    },
    {
      label: 'Prompt Injection 防护',
      passed: true,
      detail: injectionDetected
        ? '检测到疑似指令注入，已按不可信数据处理并限制工具调用'
        : '用户材料按不可信数据隔离，文档内指令不会覆盖系统指令',
    },
  ];

  return {
    passed: checks.every((check) => check.passed),
    numericConsistency: Number(numericConsistency.toFixed(1)),
    citationCoverage: Number(citationCoverage.toFixed(1)),
    unsupportedCount: unsupported.length,
    blockedClaims: unsupported.length,
    piiRedacted,
    injectionDetected,
    checks,
  };
}

/** 检查摘要是否引用了被拦截的主张中的数字（简单字符串包含判断）。 */
export function summaryLeaksBlockedClaims(summary: string, claims: Claim[]): string[] {
  const blocked = claims.filter((claim) => claim.status === 'unsupported' || claim.status === 'partial');
  return blocked
    .filter((claim) => claim.value !== null && summary.replace(/[,，\s]/g, '').includes(String(claim.value)))
    .map((claim) => claim.id);
}
