import type { ThemeMode } from '../store/settings';

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  mode: Exclude<ThemeMode, 'system' | 'custom'>;
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  lineStrong: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'green',
    label: '新绿',
    description: '默认 Material 3 绿色主题，柔和护眼',
    mode: 'light',
    bg: '#f7fbf3',
    surface: '#ffffff',
    surface2: '#edf6e7',
    surface3: '#e1efd8',
    ink: '#171d16',
    inkSoft: '#3f4a3c',
    muted: '#6f7b6a',
    line: '#dce8d4',
    lineStrong: '#c3d5b8',
  },
  {
    id: 'sage',
    label: '鼠尾草',
    description: '更中性的灰绿，适合长时间看数据',
    mode: 'light',
    bg: '#f2f6f1',
    surface: '#fcfdfb',
    surface2: '#e9f1e7',
    surface3: '#dce8d8',
    ink: '#18211a',
    inkSoft: '#3d4a40',
    muted: '#6d7a70',
    line: '#d5e0d3',
    lineStrong: '#b9c9b7',
  },
  {
    id: 'deep-green',
    label: '深林',
    description: '深绿夜间模式，低蓝光',
    mode: 'dark',
    bg: '#0f1510',
    surface: '#1a2218',
    surface2: '#222c1f',
    surface3: '#2b3727',
    ink: '#e2ebdd',
    inkSoft: '#c3d0bd',
    muted: '#9aa894',
    line: '#303c2b',
    lineStrong: '#45533e',
  },
  {
    id: 'midnight',
    label: '深蓝档案',
    description: '低饱和蓝黑，接近专业审计软件',
    mode: 'dark',
    bg: '#0e1218',
    surface: '#151b23',
    surface2: '#1c242e',
    surface3: '#24303d',
    ink: '#edf2f7',
    inkSoft: '#c9d5e1',
    muted: '#8d9bab',
    line: '#2b3744',
    lineStrong: '#3d4d5e',
  },
];

export const ACCENT_PRESETS = [
  { label: '苔绿', value: '#2e6b34' },
  { label: '松墨', value: '#00696d' },
  { label: '湖蓝', value: '#3b5ba9' },
  { label: '琥珀', value: '#8a5100' },
  { label: '莓红', value: '#a43a5a' },
  { label: '炭灰', value: '#4a5a48' },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '').trim();
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((char) => char + char)
          .join('')
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.45;
}

function mix(foreground: string, background: string, weight: number): string {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return foreground;
  const w = Math.min(1, Math.max(0, weight));
  const channel = (a: number, b: number) => Math.round(a * w + b * (1 - w));
  return `#${[channel(fg.r, bg.r), channel(fg.g, bg.g), channel(fg.b, bg.b)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * 默认底色不再写死一整片苔绿：强调色变化时，背景/卡面/分隔线
 * 从强调色混出同一色相的浅色或深色，避免“按钮变蓝、背景还是绿”
 * 用户选择鼠尾草/深林/深蓝或自定义底色时，不调用这里
 */
function accentTokens(accent: string, dark: boolean): Record<string, string> {
  if (dark) {
    const bg = mix(accent, '#0f1510', 0.14);
    const surface = mix(accent, '#1a2218', 0.1);
    const ink = '#f4efe4';
    return {
      '--bg': bg,
      '--bg-elevated': mix(accent, '#151c14', 0.12),
      '--surface': surface,
      '--surface-2': mix(accent, '#222c1f', 0.13),
      '--surface-3': mix(accent, '#2b3727', 0.16),
      '--ink': ink,
      '--ink-soft': mix(ink, bg, 0.82),
      '--muted': mix(ink, bg, 0.58),
      '--muted-2': mix(ink, bg, 0.42),
      '--line': mix(accent, bg, 0.18),
      '--line-strong': mix(accent, bg, 0.28),
    };
  }
  const bg = mix(accent, '#ffffff', 0.075);
  const ink = '#1c1a16';
  return {
    '--bg': bg,
    '--bg-elevated': mix(accent, '#ffffff', 0.1),
    '--surface': '#ffffff',
    '--surface-2': mix(accent, '#ffffff', 0.11),
    '--surface-3': mix(accent, '#ffffff', 0.17),
    '--ink': ink,
    '--ink-soft': mix(ink, bg, 0.82),
    '--muted': mix(ink, bg, 0.55),
    '--muted-2': mix(ink, bg, 0.4),
    '--line': mix(accent, bg, 0.2),
    '--line-strong': mix(accent, bg, 0.32),
  };
}

/** 把设置应用到 CSS 变量；不依赖 React，方便首屏内联脚本复用 */
export function applyTheme(input: {
  mode: ThemeMode;
  accent: string;
  customBg: string;
  customSurface: string;
  fontScale: number;
  reducedMotion: boolean;
  highContrast: boolean;
}): void {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const customIsLight = isLightColor(input.customBg);
  const effective: 'light' | 'dark' =
    input.mode === 'system' ? (prefersDark ? 'dark' : 'light') : input.mode === 'custom' ? (customIsLight ? 'light' : 'dark') : input.mode;

  root.dataset.theme = effective;
  root.dataset.contrast = input.highContrast ? 'high' : 'normal';
  root.dataset.motion = input.reducedMotion ? 'reduced' : 'normal';
  root.style.fontSize = `${16 * input.fontScale}px`;
  root.style.setProperty('--accent', input.accent);
  root.style.setProperty('--accent-ink', isLightColor(input.accent) ? '#1c1a16' : '#ffffff');

  // light / dark / system 使用 CSS 内置调色板；自定义与预设则覆盖完整 token
  const preset = THEME_PRESETS.find(
    (item) => item.mode === effective && item.bg.toLowerCase() === input.customBg.toLowerCase() && item.surface.toLowerCase() === input.customSurface.toLowerCase(),
  );

  // 默认底色跟随强调色；用户明确选了页面预设或自定义底色时，不覆盖
  const defaultLightPalette =
    input.customBg.toLowerCase() === '#f7fbf3' && input.customSurface.toLowerCase() === '#ffffff';
  const defaultDarkPalette =
    input.customBg.toLowerCase() === '#0f1510' && input.customSurface.toLowerCase() === '#1a2218';
  const seedAccent = input.accent.toLowerCase() === '#2e6b34';
  const followAccent = input.mode !== 'custom' && (defaultLightPalette || defaultDarkPalette) && !seedAccent;

  if (followAccent) {
    for (const [key, value] of Object.entries(accentTokens(input.accent, effective === 'dark'))) {
      root.style.setProperty(key, value);
    }
  } else if (input.mode === 'custom' || (input.mode !== 'system' && preset)) {
    const bg = input.customBg;
    const surface = input.customSurface;
    const ink = input.mode === 'custom' ? (customIsLight ? '#1c1a16' : '#f4efe4') : preset!.ink;
    const inkSoft = input.mode === 'custom' ? mix(ink, bg, 0.82) : preset!.inkSoft;
    const muted = input.mode === 'custom' ? mix(ink, bg, 0.55) : preset!.muted;
    const line = input.mode === 'custom' ? mix(ink, bg, 0.16) : preset!.line;
    const lineStrong = input.mode === 'custom' ? mix(ink, bg, 0.28) : preset!.lineStrong;
    const surface2 = input.mode === 'custom' ? mix(surface, bg, 0.82) : preset!.surface2;
    const surface3 = input.mode === 'custom' ? mix(surface, bg, 0.68) : preset!.surface3;

    const vars: Record<string, string> = {
      '--bg': bg,
      '--bg-elevated': surface,
      '--surface': surface,
      '--surface-2': surface2,
      '--surface-3': surface3,
      '--ink': ink,
      '--ink-soft': inkSoft,
      '--muted': muted,
      '--muted-2': mix(muted, bg, 0.7),
      '--line': line,
      '--line-strong': lineStrong,
    };
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
  } else {
    // 清除自定义覆盖，让 :root / [data-theme="dark"] 生效
    for (const key of [
      '--bg',
      '--bg-elevated',
      '--surface',
      '--surface-2',
      '--surface-3',
      '--ink',
      '--ink-soft',
      '--muted',
      '--muted-2',
      '--line',
      '--line-strong',
    ]) {
      root.style.removeProperty(key);
    }
  }
}
