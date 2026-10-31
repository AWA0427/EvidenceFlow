import { useState, type ReactNode } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { ACCENT_PRESETS, THEME_PRESETS, isLightColor } from '../lib/theme';
import { useSettingsStore, type ThemeMode } from '../store/settings';
import { cn } from '../lib/format';

type Tab = 'theme' | 'color' | 'access';

export function AppearancePanel() {
  const settings = useSettingsStore();
  const [tab, setTab] = useState<Tab>('theme');

  const activePreset = THEME_PRESETS.find(
    (preset) =>
      settings.mode === preset.mode &&
      settings.customBg.toLowerCase() === preset.bg.toLowerCase() &&
      settings.customSurface.toLowerCase() === preset.surface.toLowerCase(),
  );

  const modeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
    { value: 'system', label: '跟随系统' },
    { value: 'custom', label: '自定义' },
  ];

  const changeMode = (mode: ThemeMode) => {
    settings.setMode(mode);
    if (mode === 'light') {
      settings.setCustomBg('#f7fbf3');
      settings.setCustomSurface('#ffffff');
    }
    if (mode === 'dark') {
      settings.setCustomBg('#0f1510');
      settings.setCustomSurface('#1a2218');
    }
  };

  return (
    <>
      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="label">Appearance</span>
            <h2 className="mt-0.5 text-lg font-bold">外观与无障碍</h2>
          </div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => settings.resetAppearance()}>
            <RotateCcw className="h-3 w-3" /> 恢复默认
          </button>
        </div>

        <div className="mt-4 flex gap-1 rounded-full bg-[var(--surface-2)] p-1">
          {[
            ['theme', '主题'],
            ['color', '颜色'],
            ['access', '无障碍'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as Tab)}
              className={cn(
                'flex-1 rounded-full px-3 py-2 text-[11px] font-semibold transition-colors',
                tab === value ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--muted)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'theme' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="主题模式" hint="浅色、深色或跟随系统">
              <select className="select" value={settings.mode} onChange={(event) => changeMode(event.target.value as ThemeMode)}>
                {modeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>

            <Field label="页面底色" hint="预设会把背景和卡面一起换掉">
              <select
                className="select"
                value={activePreset?.id ?? 'custom'}
                onChange={(event) => {
                  const preset = THEME_PRESETS.find((item) => item.id === event.target.value);
                  if (!preset) {
                    settings.setMode('custom');
                    return;
                  }
                  settings.setMode(preset.mode);
                  settings.setCustomBg(preset.bg);
                  settings.setCustomSurface(preset.surface);
                }}
              >
                {THEME_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label} · {preset.mode === 'light' ? '浅色' : '深色'}</option>
                ))}
                <option value="custom">自定义颜色</option>
              </select>
            </Field>

            <Field label="强调色" hint="按钮、链接和图表主色">
              <select
                className="select"
                value={ACCENT_PRESETS.some((item) => item.value.toLowerCase() === settings.accent.toLowerCase()) ? settings.accent : 'custom'}
                onChange={(event) => {
                  if (event.target.value !== 'custom') settings.setAccent(event.target.value);
                }}
              >
                {ACCENT_PRESETS.map((accent) => (
                  <option key={accent.value} value={accent.value}>{accent.label}</option>
                ))}
                <option value="custom">自定义颜色</option>
              </select>
            </Field>

            <Field label="字号" hint="影响全站文字大小">
              <select className="select" value={settings.fontScale} onChange={(event) => settings.setFontScale(Number(event.target.value))}>
                {[0.9, 1, 1.1, 1.2].map((scale) => (
                  <option key={scale} value={scale}>{Math.round(scale * 100)}%</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {tab === 'color' && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="field-label">强调色</p>
              <div className="flex flex-wrap gap-2">
                {ACCENT_PRESETS.map((accent) => (
                  <button
                    key={accent.value}
                    type="button"
                    onClick={() => settings.setAccent(accent.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] transition-colors',
                      settings.accent.toLowerCase() === accent.value.toLowerCase()
                        ? 'border-[var(--ink)] font-bold'
                        : 'border-[var(--line)] hover:border-[var(--line-strong)]',
                    )}
                  >
                    <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: accent.value }} />
                    {accent.label}
                    {settings.accent.toLowerCase() === accent.value.toLowerCase() && <Check className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField label="强调色" value={settings.accent} onChange={settings.setAccent} />
              <ColorField label="页面背景" value={settings.customBg} onChange={(value) => { settings.setCustomBg(value); settings.setMode('custom'); }} />
              <ColorField label="卡片底色" value={settings.customSurface} onChange={(value) => { settings.setCustomSurface(value); settings.setMode('custom'); }} />
            </div>
          </div>
        )}

        {tab === 'access' && (
          <div className="mt-4 space-y-3">
            <Field label="字号" hint="90% 到 120%">
              <select className="select" value={settings.fontScale} onChange={(event) => settings.setFontScale(Number(event.target.value))}>
                {[0.9, 1, 1.1, 1.2].map((scale) => (
                  <option key={scale} value={scale}>{Math.round(scale * 100)}%</option>
                ))}
              </select>
            </Field>
            <Toggle label="减少动效" note="关闭位移动画和过渡" checked={settings.reducedMotion} onChange={settings.setReducedMotion} />
            <Toggle label="高对比度" note="加深分隔线和状态色" checked={settings.highContrast} onChange={settings.setHighContrast} />
          </div>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <span className="label">Live preview</span>
          <h3 className="mt-0.5 text-[15px] font-bold">即时预览</h3>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_180px]">
          <div className="panel-2 p-3">
            <div className="flex items-center justify-between">
              <span className="chip chip-verified">已核验</span>
              <span className="mono text-[9px] text-[var(--muted-2)]">c-gmv</span>
            </div>
            <p className="mt-3 text-[10px] text-[var(--muted)]">Q3 全渠道 GMV</p>
            <p className="metric mt-1">1,840<span className="ml-1 text-[11px] font-normal text-[var(--muted)]">万元</span></p>
            <p className="mt-2 border-l-2 border-[var(--accent)] pl-2 text-[10px] leading-5 text-[var(--muted)]">
              “Q3 全渠道 GMV 完成 <span className="highlight-quote">1,840 万元</span>，季度目标 1,600 万元。”
            </p>
          </div>
          <div className="space-y-2">
            <div className="rounded-xl border border-[var(--line)] p-2">
              <p className="text-[9px] text-[var(--muted)]">主题</p>
              <p className="mt-1 text-[10px] font-bold">
                {settings.mode === 'custom' ? (isLightColor(settings.customBg) ? '自定义浅色' : '自定义深色') : settings.mode}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-2">
              <p className="text-[9px] text-[var(--muted)]">强调色</p>
              <div className="mt-1.5 h-2 w-full rounded-full" style={{ backgroundColor: settings.accent }} />
            </div>
            <div className="rounded-xl border border-[var(--line)] p-2">
              <p className="text-[9px] text-[var(--muted)]">配置已自动保存</p>
              <p className="mt-1 text-[10px] font-bold">localStorage</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      <span className="field-hint mt-1 block">{hint}</span>
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
      <span className="text-[10px] font-semibold">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-9 cursor-pointer border border-[var(--line)] bg-transparent p-0.5"
        />
        <span className="mono text-[9px] text-[var(--muted)]">{value}</span>
      </span>
    </label>
  );
}

function Toggle({ label, note, checked, onChange }: { label: string; note: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-2.5">
      <span>
        <span className="block text-[10px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[8px] text-[var(--muted)]">{note}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-5 w-9 shrink-0 rounded-full border transition-colors', checked ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line-strong)] bg-[var(--surface-3)]')}
      >
        <span className={cn('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-[var(--surface)] shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
    </label>
  );
}
