export type AiVariantKey = 'GROK' | 'GEMINI' | 'SEED' | 'GLM' | 'DEEPSEEK' | 'HUNYUAN' | 'QWEN';

export interface AiVariantMeta {
  label: AiVariantKey;
  focus: string;
  note: string;
  features: string[];
  hideAside?: boolean;
  process?: boolean;
  extra?: string;
}

export const AI_VARIANTS: Record<AiVariantKey, AiVariantMeta> = {
  GROK: {
    label: 'GROK',
    focus: '证据优先，第一屏只留结论和拦截',
    note: '去掉 AI 缺席徽章，八步流程置顶，基准和工具调用可展开',
    features: ['八步流程置顶', '隐藏 AI 缺席徽章', '第一屏减密', '基准可展开'],
    hideAside: true,
    process: true,
  },
  GEMINI: {
    label: 'GEMINI',
    focus: '空间层次和 AI 透明度',
    note: '更大的留白、玻璃层、阶段骨架和图表色板',
    features: ['布局重构', '玻璃层次', '阶段骨架', '图表色板'],
    extra: 'layout',
  },
  SEED: {
    label: 'SEED',
    focus: 'Agent、RAG、多模态和安全',
    note: '能力矩阵是界面模拟，后端未接的能力明确标记',
    features: ['Agent 规划', '混合 RAG', 'OCR 模拟', 'MCP 模拟'],
    extra: 'capabilities',
  },
  GLM: {
    label: 'GLM',
    focus: '工程与工具，MCP 和 Prompt 可见',
    note: '8pt 网格、工具调用卡片、Prompt 可见和导出闭环',
    features: ['MCP 工具卡', 'Prompt 可见', 'Agent 轨迹', '导出闭环'],
    extra: 'tools',
    process: true,
  },
  DEEPSEEK: {
    label: 'DEEPSEEK',
    focus: '视觉层级，证据成为唯一焦点',
    note: '空状态引导、导航单 CTA、做减法和更强的视觉焦点',
    features: ['空状态引导', '单 CTA', '第一屏减密', '多步进度'],
    hideAside: true,
    process: true,
  },
  HUNYUAN: {
    label: 'HUNYUAN',
    focus: '三层信息，证据账单和为什么被拦',
    note: 'Hero KPI、主张列表、右侧抽屉和更清楚的拦截原因',
    features: ['三层看板', '证据账单', '为什么被拦', '字号提升'],
    extra: 'bill',
    process: true,
  },
  QWEN: {
    label: 'QWEN',
    focus: '减密与可读，统一导航和字号',
    note: '两套导航收敛、最小 12–13px、首屏只留主图和一个结论',
    features: ['导航统一', '字号提升', '首屏减密', '30 秒钩子'],
    hideAside: true,
    process: true,
  },
};

export function getAiVariant(): AiVariantKey | null {
  if (typeof window === 'undefined') return null;
  const query = new URLSearchParams(window.location.search).get('ai')?.toUpperCase();
  const stored = sessionStorage.getItem('evidenceflow-ai-variant')?.toUpperCase();
  const value = query || stored;
  return value && value in AI_VARIANTS ? (value as AiVariantKey) : null;
}
