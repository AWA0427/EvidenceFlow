import { useEffect, type ReactNode } from 'react';
import { useSettingsStore } from '../store/settings';
import { applyTheme } from '../lib/theme';

/**
 * 主题不是“只切一个 class”：背景、卡面、文字、分隔线、强调色、字号、
 * 高对比与减少动效都要一起变化，才能保证证据型界面在强光/暗光下都可读
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSettingsStore((state) => state.mode);
  const accent = useSettingsStore((state) => state.accent);
  const customBg = useSettingsStore((state) => state.customBg);
  const customSurface = useSettingsStore((state) => state.customSurface);
  const fontScale = useSettingsStore((state) => state.fontScale);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const highContrast = useSettingsStore((state) => state.highContrast);

  useEffect(() => {
    const apply = () => {
      applyTheme({ mode, accent, customBg, customSurface, fontScale, reducedMotion, highContrast });
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f7fbf3');
      }
    };

    apply();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (mode === 'system') apply();
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode, accent, customBg, customSurface, fontScale, reducedMotion, highContrast]);

  return <>{children}</>;
}
