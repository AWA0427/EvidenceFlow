import { useRef, useState } from 'react';
import { ArrowRight, FileText, Loader2, LockKeyhole, UploadCloud, X } from 'lucide-react';
import type { SourceKind } from '@shared/types';
import { readTextFile } from '../lib/api';

interface UploadPanelProps {
  onSubmit: (input: { title: string; text: string; sourceName: string; kind: SourceKind }) => void;
  loading?: boolean;
}

const SAMPLE = `【会议主题】某消费品牌 Q3 经营复盘
【经营总盘】
Q3 全渠道 GMV 完成 1,840 万元，季度目标 1,600 万元整体退货率 7.2%
【风险】
服饰滞销库存 95 万元，仓储占用成本环比上升 18%
【决议】
11 月 3 日前启动服饰清仓直播，目标两周消化 60% 滞销库存`;

export function UploadPanel({ onSubmit, loading = false }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sourceName, setSourceName] = useState('粘贴材料.txt');
  const [kind, setKind] = useState<SourceKind>('transcript');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = async (file: File) => {
    setError(null);
    try {
      const content = await readTextFile(file);
      setText(content);
      setSourceName(file.name);
      setTitle(file.name.replace(/\.[^.]+$/, ''));
      const extension = file.name.split('.').pop()?.toLowerCase();
      setKind(extension === 'csv' ? 'csv' : extension === 'md' ? 'markdown' : 'transcript');
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件读取失败');
    }
  };

  const canSubmit = text.trim().length >= 8 && !loading;

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center border border-[var(--line)] text-[var(--accent)]">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <div>
            <h2 className="font-serif text-[15px] font-bold">放入你的材料</h2>
            <p className="text-[10px] text-[var(--muted)]">会议纪要 / 经营复盘 / CSV 数据 · 至少 8 个字符</p>
          </div>
        </div>
        <span className="chip mono">TXT · MD · CSV</span>
      </header>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div>
            <label className="field-label" htmlFor="analysis-title">分析标题</label>
            <input
              id="analysis-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：澄野生活 Q3 经营复盘"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="source-name">材料名称</label>
            <input
              id="source-name"
              className="input"
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              placeholder="材料.txt"
            />
          </div>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void loadFile(file);
          }}
          className={`relative border border-dashed p-4 transition-colors ${
            dragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line-strong)] bg-[var(--bg-elevated)]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md,.csv,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadFile(file);
            }}
          />
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <UploadCloud className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <p className="text-[11px] font-semibold">拖入文件，或从本地选择</p>
                <p className="mt-0.5 text-[9px] text-[var(--muted)]">最大 2MB；文件内容只在本次分析中使用</p>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}>
              选择文件
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="field-label mb-0" htmlFor="source-text">或直接粘贴</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-[10px] text-[var(--accent)] hover:underline"
                onClick={() => {
                  setText(SAMPLE);
                  setTitle('某消费品牌 Q3 经营复盘');
                  setSourceName('粘贴材料.txt');
                  setKind('transcript');
                }}
              >
                填入示例片段
              </button>
              {text && (
                <button type="button" className="text-[10px] text-[var(--muted)] hover:text-[var(--ink)]" onClick={() => setText('')}>
                  <X className="mr-0.5 inline h-3 w-3" /> 清空
                </button>
              )}
            </div>
          </div>
          <textarea
            id="source-text"
            className="textarea min-h-[220px] font-mono text-[11px]"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="粘贴会议纪要、经营复盘或渠道数据&#10;&#10;最好写清楚：指标名、数值、时间范围、目标值"
          />
          <div className="mt-1.5 flex items-center justify-between text-[9px] text-[var(--muted-2)]">
            <span className="inline-flex items-center gap-1">
              <LockKeyhole className="h-3 w-3" /> 不会把材料写入公开仓库；本地历史可一键清除
            </span>
            <span className="mono">{text.length.toLocaleString('zh-CN')} chars</span>
          </div>
        </div>

        {error && <p className="border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[10px] text-[var(--danger)]">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
          <p className="max-w-[420px] text-[9px] leading-5 text-[var(--muted)]">
            没 Key 时用本地规则，只抽带数字的句子；有 Key 时模型负责抽取和综合，数字仍由本地校验器复核
          </p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!canSubmit}
            onClick={() => onSubmit({ title: title.trim() || sourceName, text, sourceName, kind })}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            {loading ? '正在建立证据链' : '开始分析'}
          </button>
        </div>
      </div>
    </section>
  );
}
