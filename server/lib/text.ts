/**
 * 文本、数字与 CSV 的确定性处理工具
 *
 * 这一层刻意不依赖大模型：数字的解析、归一化和引用定位必须可复现，
 * 否则「证据链」就会退化成另一段由模型编出来的解释
 */

export interface QuoteLocation {
  start: number;
  end: number;
  quote: string;
}

const PUNCTUATION_MAP: Record<string, string> = {
  '，': ',',
  '': '.',
  '；': ';',
  '：': ':',
  '！': '!',
  '？': '?',
  '（': '(',
  '）': ')',
  '【': '[',
  '】': ']',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '—': '-',
  '–': '-',
  '　': ' ',
};

/** 归一化文本，同时保留「归一化下标 -> 原文下标」的映射 */
function normalizeWithMap(input: string): { text: string; map: number[] } {
  let text = '';
  const map: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const raw = input[i];
    const mapped = PUNCTUATION_MAP[raw] ?? raw;
    // 空白不进入归一化文本，但仍保留下标映射，确保无空格引用也能定位
    if (/\s/.test(mapped)) continue;
    text += mapped.toLowerCase();
    map.push(i);
  }
  return { text, map };
}

/** 在原文中定位一句话精确匹配失败时返回 null，由上层决定降级策略 */
export function locateQuote(source: string, quote: string): QuoteLocation | null {
  const cleanQuote = quote.trim();
  if (!cleanQuote) return null;

  const direct = source.indexOf(cleanQuote);
  if (direct >= 0) {
    return { start: direct, end: direct + cleanQuote.length, quote: cleanQuote };
  }

  const normalizedSource = normalizeWithMap(source);
  const normalizedQuote = normalizeWithMap(cleanQuote).text.trim();
  if (!normalizedQuote) return null;

  const hit = normalizedSource.text.indexOf(normalizedQuote);
  if (hit < 0) return null;

  const start = normalizedSource.map[hit];
  const end = normalizedSource.map[hit + normalizedQuote.length - 1] + 1;
  return { start, end, quote: source.slice(start, end) };
}

/** 截取引用附近的上下文，供证据抽屉展示 */
export function contextAround(source: string, location: QuoteLocation, radius = 90): string {
  const start = Math.max(0, location.start - radius);
  const end = Math.min(source.length, location.end + radius);
  return `${start > 0 ? '…' : ''}${source.slice(start, end)}${end < source.length ? '…' : ''}`;
}

const NUMBER_PATTERN = /[-+]?\d[\d,，]*(?:\.\d+)?/;

/** 从「1,840 万元」「7.2%」「118ms」这类字符串中提取数值 */
export function parseNumber(input: string | number | null | undefined): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (!input) return null;
  const match = String(input).replace(/\s/g, '').match(NUMBER_PATTERN);
  if (!match) return null;
  const value = Number(match[0].replace(/[,，]/g, ''));
  return Number.isFinite(value) ? value : null;
}

export function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${formatNumber(value, digits)}%`;
}

/** 判断一个数值是否在原文中「有迹可循」 */
export function numberAppearsInText(value: number | null, text: string): boolean {
  if (value === null) return false;
  const candidates = new Set<string>([
    String(value),
    value.toFixed(1),
    value.toFixed(2),
    formatNumber(value, 1),
    formatNumber(value, 2),
  ]);
  const compact = text.replace(/[\s,，]/g, '');
  for (const candidate of candidates) {
    if (candidate && compact.includes(candidate.replace(/[\s,，]/g, ''))) return true;
  }
  return false;
}

/** 计算两个数的增长率，target 为 0 时返回 null */
export function growthRate(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function achievementRate(actual: number, target: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target === 0) return null;
  return (actual / target) * 100;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return sum(values) / values.length;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** 极简 CSV 解析：支持双引号、逗号、换行；足够覆盖演示与常见导出 */
export function parseCsv(text: string): {
  headers: string[];
  rows: Array<Record<string, string | number | null>>;
} {
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = '';
  };
  const pushRow = () => {
    if (row.some((cell) => cell.length > 0)) records.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      pushField();
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      pushField();
      pushRow();
    } else {
      field += char;
    }
  }
  pushField();
  pushRow();

  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].map((header) => header || `列${records[0].indexOf(header) + 1}`);
  const rows = records.slice(1).map((cells) => {
    const record: Record<string, string | number | null> = {};
    headers.forEach((header, index) => {
      const raw = cells[index] ?? '';
      const numeric = parseNumber(raw);
      const looksNumeric = numeric !== null && /^[-+]?[\d,，.]+%?$/.test(raw.trim());
      record[header] = looksNumeric ? numeric : raw;
    });
    return record;
  });
  return { headers, rows };
}

/** 粗略判断文本是否像 CSV，用于自动选择解析器 */
export function looksLikeCsv(text: string): boolean {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 3) return false;
  const commaCounts = lines.slice(0, 5).map((line) => (line.match(/,/g) ?? []).length);
  return commaCounts.every((count) => count >= 1) && new Set(commaCounts).size === 1;
}

export function truncate(text: string, max = 180): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
