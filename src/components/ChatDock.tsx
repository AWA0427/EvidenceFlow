import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, Loader2, MessageSquareText, Mic, MicOff, Minimize2, Quote, Sparkles, Volume2, Wrench, X } from 'lucide-react';
import type { AnalysisResult, ChatCitation, ChatMessage, ToolCall } from '@shared/types';
import { streamChat } from '../lib/api';
import { cn } from '../lib/format';
import { useSettingsStore } from '../store/settings';

interface ChatDockProps {
  analysis: AnalysisResult;
  onCitation: (claimId: string) => void;
}

const SUGGESTIONS = ['当前最大的经营风险是什么？', '这个数字在行业里算正常吗？', '下一步应该先做什么？'];

interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor });
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export function ChatDock({ analysis, onCitation }: ChatDockProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const settings = useSettingsStore();
  const speechSupported = Boolean(getSpeechRecognition());

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Constructor = getSpeechRecognition();
    if (!Constructor) {
      setError('当前浏览器不支持语音识别，请使用 Chrome / Edge 并允许麦克风权限。');
      return;
    }
    try {
      const recognition = new Constructor();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? '';
        if (transcript) setInput((previous) => `${previous}${previous ? ' ' : ''}${transcript}`);
      };
      recognition.onerror = (event) => {
        setError(`语音识别失败：${event.error ?? '未知错误'}`);
        setListening(false);
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setError(null);
    } catch {
      setError('无法启动语音识别，请检查浏览器麦克风权限。');
      setListening(false);
    }
  };

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setError('当前浏览器不支持语音朗读。');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/\[[a-zA-Z0-9_-]+\]/g, ''));
    utterance.lang = 'zh-CN';
    utterance.rate = 1.04;
    window.speechSynthesis.speak(utterance);
  };

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || streaming) return;
    setError(null);
    setInput('');
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: 'assistant', content: '', streaming: true, createdAt: new Date().toISOString() },
    ]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        {
          question: trimmed,
          analysisId: analysis.id,
          analysis,
          history: messages.slice(-6).map((message) => ({ role: message.role, content: message.content })),
          model: settings.model,
        },
        {
          onEvent: (event) => {
            if (event.type === 'token') {
              setMessages((prev) =>
                prev.map((message) => (message.id === assistantId ? { ...message, content: message.content + event.text } : message)),
              );
            }
            if (event.type === 'citation') {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        citations: [...(message.citations ?? []).filter((item) => item.id !== event.citation.id), event.citation],
                      }
                    : message,
                ),
              );
            }
            if (event.type === 'tool') {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId ? { ...message, toolCalls: [...(message.toolCalls ?? []), event.tool] } : message,
                ),
              );
            }
            if (event.type === 'error') setError(event.message);
            if (event.type === 'done') {
              setMessages((prev) => prev.map((message) => (message.id === assistantId ? { ...message, streaming: false } : message)));
              setStreaming(false);
            }
          },
          onError: (message) => setError(message),
        },
        controller.signal,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '回答失败');
      setMessages((prev) => prev.map((message) => (message.id === assistantId ? { ...message, streaming: false } : message)));
      setStreaming(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="chat-dock no-print fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--ink)] px-4 py-3 text-[var(--surface)] shadow-[var(--shadow-lg)] transition-transform hover:-translate-y-0.5"
        aria-label="打开追问证据面板"
      >
        <MessageSquareText className="h-4 w-4" />
        <span className="text-[11px] font-semibold">追问证据</span>
        {messages.length > 0 && <span className="mono text-[9px] opacity-60">{messages.length}</span>}
      </button>
    );
  }

  return (
    <aside className="chat-dock no-print fixed bottom-0 right-0 z-50 flex h-[min(680px,92vh)] w-full flex-col border-l border-t border-[var(--line-strong)] bg-[var(--surface)] shadow-[var(--shadow-lg)] sm:bottom-4 sm:right-4 sm:w-[400px] sm:border">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-bold">追问证据</p>
            <p className="text-[9px] text-[var(--muted)]">回答只来自当前看板与基准库</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-icon btn-quiet"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            aria-label="清空对话"
            title="清空对话"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="btn btn-icon btn-quiet" onClick={() => setOpen(false)} aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <div className="flex items-center gap-1.5 text-[var(--accent)]">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold">可以问这些</span>
              </div>
              <p className="mt-1.5 text-[10px] leading-5 text-[var(--muted)]">
                问数字、风险、行业基准或下一步。涉及数字时，回答会带引用。
              </p>
            </div>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left text-[10px] text-[var(--ink-soft)] transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={cn('flex flex-col gap-1', message.role === 'user' ? 'items-end' : 'items-start')}>
            <div className={`chat-bubble ${message.role} ${message.streaming ? 'typing-caret' : ''}`}>
              {message.content ? renderContent(message.content, onCitation, analysis) : <span className="text-[var(--muted)]">正在检索证据…</span>}
            </div>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {message.toolCalls.map((tool) => (
                  <span key={tool.id} className="chip mono text-[8px]">
                    <Wrench className="h-2.5 w-2.5" /> {tool.name} · {tool.durationMs}ms
                  </span>
                ))}
              </div>
            )}
            {message.citations && message.citations.length > 0 && (
              <div className="w-full space-y-1">
                {message.citations.map((citation) => (
                  <button
                    key={citation.id}
                    type="button"
                    onClick={() => onCitation(citation.id)}
                    className="flex w-full items-start gap-2 border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1.5 text-left transition-colors hover:border-[var(--accent-border)]"
                  >
                    <Quote className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[9px] font-semibold">{citation.label}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[8px] leading-4 text-[var(--muted)]">{citation.quote}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {message.role === 'assistant' && message.content && !message.streaming && (
              <button
                type="button"
                onClick={() => speak(message.content)}
                className="inline-flex items-center gap-1 text-[8px] text-[var(--muted-2)] transition-colors hover:text-[var(--accent)]"
              >
                <Volume2 className="h-2.5 w-2.5" /> 朗读回答
              </button>
            )}
          </div>
        ))}

        {error && (
          <div className="border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[10px] leading-5 text-[var(--danger)]">{error}</div>
        )}
      </div>

      <div className="border-t border-[var(--line)] p-2.5">
        <div className="flex items-end gap-2 border border-[var(--line)] bg-[var(--bg-elevated)] p-1.5 focus-within:border-[var(--accent)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            placeholder="例如：服饰库存 95 万，最该先做什么？"
            className="max-h-24 min-h-[38px] flex-1 resize-none bg-transparent px-1 py-1 text-[11px] leading-5 outline-none placeholder:text-[var(--muted-2)]"
          />
          {speechSupported && (
            <button
              type="button"
              className={`btn btn-icon shrink-0 ${listening ? 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]' : 'btn-quiet'}`}
              onClick={toggleVoice}
              aria-label={listening ? '停止语音输入' : '语音输入'}
              title={listening ? '停止语音输入' : '语音输入（Web Speech API）'}
            >
              {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-icon shrink-0"
            onClick={() => void send(input)}
            disabled={streaming || !input.trim()}
            aria-label="发送"
          >
            {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1 text-center text-[8px] text-[var(--muted-2)]">Enter 发送 · Shift + Enter 换行 · 回答不一定构成经营建议</p>
      </div>
    </aside>
  );
}

function renderContent(content: string, onCitation: (claimId: string) => void, analysis: AnalysisResult) {
  const parts = content.split(/(\[[a-zA-Z0-9_-]+\])/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^\[([a-zA-Z0-9_-]+)\]$/);
        if (match) {
          const id = match[1];
          const claim = analysis.claims.find((item) => item.id === id);
          if (claim) {
            return (
              <button key={`${part}-${index}`} type="button" onClick={() => onCitation(id)} className="evidence-ref mono text-[9px]">
                {id}
              </button>
            );
          }
        }
        return (
          <span key={`${part}-${index}`} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </>
  );
}
