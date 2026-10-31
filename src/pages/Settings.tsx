import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Wand2,
  XCircle,
} from 'lucide-react';
import type { ApiConfigResponse } from '@shared/types';
import { AppearancePanel } from '../components/AppearancePanel';
import { clearClientKey, downloadJSON, fetchConfig, getClientKey, setClientKey } from '../lib/api';
import { ACCENT_PRESETS, THEME_PRESETS, isLightColor } from '../lib/theme';
import { useAnalysisStore } from '../store/analysis';
import { useSettingsStore, type ThemeMode } from '../store/settings';
import { cn } from '../lib/format';

type Section = 'api' | 'appearance' | 'data' | 'about';

export function Settings() {
  const settings = useSettingsStore();
  const history = useAnalysisStore((state) => state.history);
  const clearHistory = useAnalysisStore((state) => state.removeHistory);
  const [section, setSection] = useState<Section>('api');
  const [config, setConfig] = useState<ApiConfigResponse | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [savedKey, setSavedKey] = useState(Boolean(getClientKey()));

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
    setKeyInput(getClientKey());
  }, []);

  const sections: Array<{ id: Section; label: string; icon: typeof KeyRound; note: string }> = [
    { id: 'api', label: 'API 与模型', icon: KeyRound, note: 'Key / Base URL / Model' },
    { id: 'appearance', label: '外观与无障碍', icon: Palette, note: '深浅色 / 背景 / 字号' },
    { id: 'data', label: '数据与隐私', icon: Database, note: '导出 / 清除 / 存储' },
    { id: 'about', label: '关于本项目', icon: ShieldCheck, note: '版本与边界' },
  ];

  return (
    <div className="container-wide py-8">
      <div className="mb-6">
        <div className="kicker">Settings</div>
        <h1 className="display-md mt-3">设置</h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-6 text-[var(--muted)]">
          这里改主题、字号和模型。设置会保存到当前浏览器；临时 Key 只在当前标签页有效。
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[calc(var(--header)+20px)] lg:self-start">
          <nav className="panel p-2">
            {sections.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-l-2 px-2.5 py-2.5 text-left transition-colors',
                    section === item.id
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                      : 'border-transparent text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
                  )}
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="block text-[11px] font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-[9px] text-[var(--muted-2)]">{item.note}</span>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="mt-3 border border-dashed border-[var(--line-strong)] p-3 text-[9px] leading-5 text-[var(--muted)]">
            <span className="font-semibold text-[var(--ink-soft)]">快捷键：</span>
            按 <kbd className="mono rounded border border-[var(--line)] px-1">Esc</kbd> 关闭抽屉，<kbd className="mono rounded border border-[var(--line)] px-1">Enter</kbd> 在追问框发送。
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {section === 'api' && (
            <ApiSection
              config={config}
              keyInput={keyInput}
              setKeyInput={setKeyInput}
              showKey={showKey}
              setShowKey={setShowKey}
              testing={testing}
              testResult={testResult}
              savedKey={savedKey}
              onSave={() => {
                setClientKey(keyInput);
                setSavedKey(Boolean(keyInput.trim()));
                setTestResult({ ok: true, message: keyInput.trim() ? '临时 Key 已保存到当前标签页。' : '已清除临时 Key。' });
              }}
              onTest={async () => {
                setTesting(true);
                setTestResult(null);
                try {
                  const response = await fetch('/api/test-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      clientKey: keyInput.trim() || undefined,
                      baseUrl: settings.apiBase,
                      model: settings.model,
                    }),
                  });
                  const json = (await response.json()) as { ok: boolean; latency?: number; error?: string; reply?: string; model?: string };
                  if (json.ok) {
                    setTestResult({ ok: true, message: `连接成功 · ${json.model} · ${json.latency}ms · 返回「${json.reply}」` });
                  } else {
                    setTestResult({ ok: false, message: json.error || '连接失败' });
                  }
                } catch (error) {
                  setTestResult({ ok: false, message: error instanceof Error ? error.message : '连接失败' });
                } finally {
                  setTesting(false);
                }
              }}
              onClear={() => {
                clearClientKey();
                setKeyInput('');
                setSavedKey(false);
                setTestResult({ ok: true, message: '已清除当前标签页的临时 Key。' });
              }}
            />
          )}
          {section === 'appearance' && <AppearancePanel />}
          {section === 'data' && <DataSection history={history} clearHistory={clearHistory} />}
          {section === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  );
}

function ApiSection({
  config,
  keyInput,
  setKeyInput,
  showKey,
  setShowKey,
  testing,
  testResult,
  savedKey,
  onSave,
  onTest,
  onClear,
}: {
  config: ApiConfigResponse | null;
  keyInput: string;
  setKeyInput: (value: string) => void;
  showKey: boolean;
  setShowKey: (value: boolean) => void;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
  savedKey: boolean;
  onSave: () => void;
  onTest: () => void;
  onClear: () => void;
}) {
  const settings = useSettingsStore();
  const serverReady = Boolean(config?.hasServerKey);
  const clientKeyAllowed = config?.allowClientKey !== false;

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
          <div>
            <span className="label">Model gateway</span>
            <h2 className="mt-0.5 font-serif text-lg font-bold">API 与模型</h2>
          </div>
          <span className={cn('chip', serverReady ? 'chip-verified' : 'chip-warning')}>
            <span className="status-dot" /> {serverReady ? '服务端 Key 已配置' : '未配置服务端 Key'}
          </span>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="api-base">Base URL</label>
              <input
                id="api-base"
                className="input mono text-[11px]"
                value={settings.apiBase}
                onChange={(event) => settings.setApiBase(event.target.value)}
                placeholder="https://api.deepseek.com"
              />
              <p className="field-hint mt-1">DeepSeek 官方地址不带 /v1；OpenAI 兼容网关通常带 /v1。</p>
            </div>
            <div>
              <label className="field-label" htmlFor="api-model">Model</label>
              <input
                id="api-model"
                className="input mono text-[11px]"
                value={settings.model}
                onChange={(event) => settings.setModel(event.target.value)}
                placeholder="deepseek-chat"
              />
              <p className="field-hint mt-1">换模型不会改变证据校验逻辑，只改变抽取与解释质量。</p>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="api-key">临时 API Key（只存当前标签页）</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  className="input mono pl-8 pr-9 text-[11px]"
                  value={keyInput}
                  onChange={(event) => setKeyInput(event.target.value)}
                  placeholder={
                    !clientKeyAllowed
                      ? '服务端已禁用浏览器临时 Key'
                      : serverReady
                        ? '服务端已配置；留空即使用服务端 Key'
                        : 'sk-…（不会上传到 GitHub）'
                  }
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!clientKeyAllowed}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
                  onClick={() => setShowKey(!showKey)}
                  aria-label={showKey ? '隐藏 Key' : '显示 Key'}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onSave} disabled={!clientKeyAllowed}>
                保存
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={onTest} disabled={testing || (!clientKeyAllowed && !serverReady)}>
                {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} 测试
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <p className="field-hint">
                {!clientKeyAllowed
                  ? '当前服务端已关闭浏览器临时 Key（ALLOW_CLIENT_KEY=false），请使用服务端环境变量配置。'
                  : '页面不会把 Key 写入 localStorage；关闭标签页即失效。公网部署建议在服务端配置 DEEPSEEK_API_KEY。'}
              </p>
              {savedKey && clientKeyAllowed && <span className="chip chip-verified">当前会话已保存</span>}
              {keyInput && (
                <button type="button" className="text-[9px] text-[var(--danger)] hover:underline" onClick={onClear}>
                  清除临时 Key
                </button>
              )}
            </div>
          </div>

          {testResult && (
            <div
              className={cn(
                'flex items-start gap-2 border px-3 py-2 text-[10px] leading-5',
                testResult.ok
                  ? 'border-[var(--verified)] bg-[var(--verified-soft)] text-[var(--verified)]'
                  : 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]',
              )}
            >
              {testResult.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              {testResult.message}
            </div>
          )}

          <div className="grid gap-2 border-t border-[var(--line)] pt-4 sm:grid-cols-3">
            {[
              ['流式输出', config?.capabilities.streaming ? '已启用' : '—', 'SSE 逐字渲染'],
              ['Function Calling', config?.capabilities.functionCalling ? '已启用' : '—', '工具白名单'],
              ['视觉模型', config?.capabilities.vision ? '已配置' : '未配置', 'PDF / 图表识别'],
            ].map(([label, value, note]) => (
              <div key={label} className="border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                <p className="text-[9px] text-[var(--muted)]">{label}</p>
                <p className="mt-1 text-[10px] font-bold">{value}</p>
                <p className="mt-0.5 text-[8px] text-[var(--muted-2)]">{note}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 border border-[var(--line)] bg-[var(--bg-elevated)] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--verified)]" />
            <div>
              <p className="text-[10px] font-bold">安全边界</p>
              <p className="mt-1 text-[9px] leading-5 text-[var(--muted)]">
                服务端 Key 永远不会出现在前端 bundle；临时 Key 通过请求头传给 BFF，不写入日志。仓库只提交 <code className="mono">.env.example</code>。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-[11px] font-bold">生成参数</h3>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <label className="field-label mb-0" htmlFor="temperature">Temperature</label>
            <span className="mono text-[10px] text-[var(--muted)]">{settings.temperature.toFixed(1)}</span>
          </div>
          <input
            id="temperature"
            type="range"
            min={0}
            max={0.8}
            step={0.1}
            value={settings.temperature}
            onChange={(event) => settings.setTemperature(Number(event.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
          <p className="field-hint mt-1">建议 0.1–0.3。抽取与校验不依赖温度，温度只影响解释文本的措辞。</p>
        </div>
      </section>
    </>
  );
}

function AppearanceSection() {
  const settings = useSettingsStore();
  const modeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun; note: string }> = [
    { value: 'light', label: '浅色', icon: Sun, note: '新绿 / 鼠尾草' },
    { value: 'dark', label: '深色', icon: Moon, note: '深林 / 深蓝' },
    { value: 'system', label: '跟随系统', icon: Monitor, note: '自动切换' },
    { value: 'custom', label: '自定义', icon: Palette, note: '自己调色' },
  ];

  return (
    <>
      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="label">Appearance</span>
            <h2 className="mt-0.5 font-serif text-lg font-bold">外观与无障碍</h2>
          </div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => settings.resetAppearance()}>
            <RotateCcw className="h-3 w-3" /> 恢复默认
          </button>
        </div>

        <div className="mt-4">
          <p className="field-label">主题模式</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {modeOptions.map((option) => {
              const Icon = option.icon;
              const active = settings.mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    settings.setMode(option.value);
                    if (option.value === 'light') {
                      settings.setCustomBg('#f7fbf3');
                      settings.setCustomSurface('#ffffff');
                    }
                    if (option.value === 'dark') {
                      settings.setCustomBg('#0f1510');
                      settings.setCustomSurface('#1a2218');
                    }
                  }}
                  className={cn(
                    'flex flex-col items-start gap-2 border p-3 text-left transition-colors',
                    active ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] hover:border-[var(--line-strong)]',
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-[var(--accent)]' : 'text-[var(--muted)]')} />
                  <span className="text-[11px] font-bold">{option.label}</span>
                  <span className="text-[8px] text-[var(--muted)]">{option.note}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="field-label">强调色</p>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((accent) => (
              <button
                key={accent.value}
                type="button"
                onClick={() => settings.setAccent(accent.value)}
                className={cn(
                  'flex items-center gap-2 border px-2.5 py-1.5 text-[10px] transition-colors',
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
            <label className="flex cursor-pointer items-center gap-2 border border-dashed border-[var(--line-strong)] px-2.5 py-1.5 text-[10px] text-[var(--muted)]">
              <input
                type="color"
                value={settings.accent}
                onChange={(event) => settings.setAccent(event.target.value)}
                className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
              />
              自定义
            </label>
          </div>
        </div>

        <div className="mt-5">
          <p className="field-label">页面底色预设</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {THEME_PRESETS.map((preset) => {
              const active =
                settings.mode === preset.mode &&
                settings.customBg.toLowerCase() === preset.bg.toLowerCase() &&
                settings.customSurface.toLowerCase() === preset.surface.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    settings.setMode(preset.mode);
                    settings.setCustomBg(preset.bg);
                    settings.setCustomSurface(preset.surface);
                  }}
                  className={cn(
                    'flex items-center justify-between gap-3 border p-3 text-left transition-colors',
                    active ? 'border-[var(--accent)]' : 'border-[var(--line)] hover:border-[var(--line-strong)]',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-12 items-center justify-center border text-[9px]"
                      style={{ backgroundColor: preset.bg, color: preset.ink, borderColor: preset.line }}
                    >
                      Aa
                    </span>
                    <span>
                      <span className="block text-[10px] font-bold">{preset.label}</span>
                      <span className="mt-0.5 block text-[8px] text-[var(--muted)]">{preset.description}</span>
                    </span>
                  </span>
                  {active && <Check className="h-3.5 w-3.5 text-[var(--accent)]" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 border border-[var(--line)] bg-[var(--surface-2)] p-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold">自定义背景</span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                value={settings.customBg}
                onChange={(event) => {
                  settings.setCustomBg(event.target.value);
                  settings.setMode('custom');
                }}
                className="h-7 w-9 cursor-pointer border border-[var(--line)] bg-transparent p-0.5"
              />
              <span className="mono text-[9px] text-[var(--muted)]">{settings.customBg}</span>
            </span>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold">自定义卡面</span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                value={settings.customSurface}
                onChange={(event) => {
                  settings.setCustomSurface(event.target.value);
                  settings.setMode('custom');
                }}
                className="h-7 w-9 cursor-pointer border border-[var(--line)] bg-transparent p-0.5"
              />
              <span className="mono text-[9px] text-[var(--muted)]">{settings.customSurface}</span>
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="field-label">字号</p>
            <div className="flex gap-1">
              {[0.9, 1, 1.1, 1.2].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => settings.setFontScale(scale)}
                  className={cn(
                    'flex-1 border py-1.5 text-[10px] transition-colors',
                    settings.fontScale === scale ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--surface)]' : 'border-[var(--line)] text-[var(--muted)]',
                  )}
                >
                  {Math.round(scale * 100)}%
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Toggle label="减少动效" note="关闭位移动画与过渡" checked={settings.reducedMotion} onChange={settings.setReducedMotion} />
            <Toggle label="高对比度" note="加深分隔线与状态色" checked={settings.highContrast} onChange={settings.setHighContrast} />
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <span className="label">Live preview</span>
          <h3 className="mt-0.5 font-serif text-[15px] font-bold">即时预览</h3>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_180px]">
          <div className="panel-2 p-3">
            <div className="flex items-center justify-between">
              <span className="chip chip-verified"><CheckCircle2 className="h-2.5 w-2.5" /> 已核验</span>
              <span className="mono text-[9px] text-[var(--muted-2)]">c-gmv</span>
            </div>
            <p className="mt-3 text-[10px] text-[var(--muted)]">Q3 全渠道 GMV</p>
            <p className="metric mt-1">1,840<span className="ml-1 text-[11px] font-normal text-[var(--muted)]">万元</span></p>
            <p className="mt-2 border-l-2 border-[var(--accent)] pl-2 text-[10px] leading-5 text-[var(--muted)]">
              “Q3 全渠道 GMV 完成 <span className="highlight-quote">1,840 万元</span>，季度目标 1,600 万元。”
            </p>
          </div>
          <div className="space-y-2">
            <div className="border border-[var(--line)] p-2">
              <p className="text-[9px] text-[var(--muted)]">主题</p>
              <p className="mt-1 text-[10px] font-bold">{settings.mode === 'custom' ? (isLightColor(settings.customBg) ? '自定义浅色' : '自定义深色') : settings.mode}</p>
            </div>
            <div className="border border-[var(--line)] p-2">
              <p className="text-[9px] text-[var(--muted)]">强调色</p>
              <div className="mt-1.5 h-2 w-full" style={{ backgroundColor: settings.accent }} />
            </div>
            <div className="border border-[var(--line)] p-2">
              <p className="text-[9px] text-[var(--muted)]">配置已自动保存</p>
              <p className="mt-1 text-[10px] font-bold">localStorage</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Toggle({ label, note, checked, onChange }: { label: string; note: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border border-[var(--line)] px-2.5 py-2">
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
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-[var(--surface)] shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

function DataSection({ history, clearHistory }: { history: ReturnType<typeof useAnalysisStore.getState>['history']; clearHistory: (id: string) => void }) {
  const [cleared, setCleared] = useState(false);

  return (
    <>
      <section className="panel p-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <span className="label">Data & privacy</span>
            <h2 className="mt-0.5 font-serif text-lg font-bold">数据与隐私</h2>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-6 text-[var(--muted)]">
          证析默认不建账号、不上传历史到服务器。分析结果保存在当前浏览器的 localStorage，临时 API Key 只存在 sessionStorage。
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ['分析历史', `${history.length} 条`, 'localStorage'],
            ['临时 Key', getClientKey() ? '当前会话有效' : '未保存', 'sessionStorage'],
            ['服务端材料', '不持久化', '仅内存处理'],
          ].map(([label, value, note]) => (
            <div key={label} className="border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <p className="text-[9px] text-[var(--muted)]">{label}</p>
              <p className="mt-1 text-[11px] font-bold">{value}</p>
              <p className="mt-0.5 text-[8px] text-[var(--muted-2)]">{note}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => downloadJSON(`evidenceflow-history-${Date.now()}.json`, history)}
            disabled={history.length === 0}
          >
            <Database className="h-3 w-3" /> 导出本地历史 JSON
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              clearClientKey();
              setCleared(true);
              setTimeout(() => setCleared(false), 1500);
            }}
          >
            <KeyRound className="h-3 w-3" /> {cleared ? '已清除' : '清除临时 Key'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm text-[var(--danger)]"
            onClick={() => {
              if (window.confirm('确定清除全部本地分析历史？此操作不可撤销。')) {
                history.forEach((item) => clearHistory(item.id));
              }
            }}
          >
            <Trash2 className="h-3 w-3" /> 清除全部分析历史
          </button>
        </div>
      </section>

      <section className="panel p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[var(--verified)]" />
          <h3 className="text-[11px] font-bold">公开仓库安全清单</h3>
        </div>
        <ul className="mt-3 space-y-2 text-[10px] leading-5 text-[var(--muted)]">
          {[
            ['API Key 不进入 Git', '只保留 .env.example；.env.local 已在 .gitignore 中。'],
            ['材料不写入服务端磁盘', '分析在内存中完成；历史只存在浏览器。'],
            ['PII 脱敏后才发给模型', '手机号、身份证、邮箱、银行卡会先做掩码。'],
            ['工具调用白名单', '文档中的“请调用工具”不会直接执行。'],
            ['失败可见', '模型超时会明确降级，不伪装成实时结果。'],
          ].map(([title, body]) => (
            <li key={title} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--verified)]" />
              <span><strong className="text-[var(--ink-soft)]">{title}</strong>：{body}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function AboutSection() {
  return (
    <section className="panel p-5">
      <div className="flex items-center gap-3">
        <span className="seal">证</span>
        <div>
          <h2 className="font-serif text-xl font-bold">证析 EvidenceFlow</h2>
          <p className="mono text-[9px] text-[var(--muted)]">EVIDENCE-FIRST DECISION INTELLIGENCE</p>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-[12px] leading-7 text-[var(--ink-soft)]">
        AI 说的每个数字，都能点回原文。证析是一套面向经营复盘与决策会的可审计工作台：抽取、校验、检索、质疑、发布闸门各司其职。
      </p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ['版本', 'v0.1.0 · 2026.10'],
          ['前端', 'React 19 + TypeScript + Vite 8 + Tailwind CSS 4'],
          ['后端', 'Node.js + Express + SSE'],
          ['证据', '原文引用 + 受限四则运算 + BM25'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-[var(--line)] pb-2 text-[10px]">
            <dt className="text-[var(--muted)]">{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[9px] leading-5 text-[var(--muted-2)]">
        本项目为 2026 全国高校 AI Web 开发挑战赛参赛作品基础版。AI 输出不构成审计、法律或投资建议；正式使用前请由业务负责人复核口径。
      </p>
    </section>
  );
}
