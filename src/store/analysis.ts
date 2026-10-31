import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentStep, AnalysisResult, AnalyzeRequest, SourceKind } from '@shared/types';
import { streamAnalysis } from '../lib/api';
import { useSettingsStore } from './settings';

type Phase = 'idle' | 'loading' | 'ready' | 'error';

interface RunInput {
  title?: string;
  text: string;
  sourceName?: string;
  kind?: SourceKind;
}

interface AnalysisState {
  analysis: AnalysisResult | null;
  history: AnalysisResult[];
  steps: AgentStep[];
  phase: Phase;
  error: string | null;
  notice: string | null;
  runDemo: (caseId: string) => Promise<void>;
  runText: (input: RunInput) => Promise<void>;
  loadHistory: (id: string) => void;
  removeHistory: (id: string) => void;
  reset: () => void;
  clearError: () => void;
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set, get) => ({
      analysis: null,
      history: [],
      steps: [],
      phase: 'idle',
      error: null,
      notice: null,

      runDemo: async (caseId) => {
        set({ phase: 'loading', steps: [], error: null, notice: null, analysis: null });
        try {
          const result = await streamAnalysis(
            { demoCaseId: caseId, text: '' },
            {
              onEvent: (event) => {
                if (event.type === 'stage') {
                  set((state) => ({ steps: [...state.steps.filter((item) => item.id !== event.step.id), event.step] }));
                }
                if (event.type === 'token') set({ notice: event.text });
                if (event.type === 'error') set({ error: event.message });
                if (event.type === 'result') {
                  set((state) => ({
                    analysis: event.data,
                    steps: event.data.agentSteps,
                    phase: 'ready',
                    history: [event.data, ...state.history.filter((item) => item.id !== event.data.id)].slice(0, 5),
                  }));
                }
              },
              onError: (message) => set({ error: message }),
            },
          );
          if (!result && get().phase !== 'ready') {
            set({ phase: 'error', error: get().error || '分析没有返回结果，请重试。' });
          }
        } catch (error) {
          set({ phase: 'error', error: error instanceof Error ? error.message : '分析失败，请重试。' });
        }
      },

      runText: async (input) => {
        set({ phase: 'loading', steps: [], error: null, notice: null, analysis: null });
        const settings = useSettingsStore.getState();
        try {
          const result = await streamAnalysis(
            {
              ...input,
              baseUrl: settings.apiBase,
              model: settings.model,
            } as AnalyzeRequest,
            {
              onEvent: (event) => {
                if (event.type === 'stage') {
                  set((state) => ({ steps: [...state.steps.filter((item) => item.id !== event.step.id), event.step] }));
                }
                if (event.type === 'token') set({ notice: event.text });
                if (event.type === 'error') set({ error: event.message });
                if (event.type === 'result') {
                  set((state) => ({
                    analysis: event.data,
                    steps: event.data.agentSteps,
                    phase: 'ready',
                    history: [event.data, ...state.history.filter((item) => item.id !== event.data.id)].slice(0, 5),
                  }));
                }
              },
              onError: (message) => set({ error: message }),
            },
          );
          if (!result && get().phase !== 'ready') {
            set({ phase: 'error', error: get().error || '分析没有返回结果，请重试。' });
          }
        } catch (error) {
          set({ phase: 'error', error: error instanceof Error ? error.message : '分析失败，请重试。' });
        }
      },

      loadHistory: (id) => {
        const item = get().history.find((entry) => entry.id === id);
        if (!item) return;
        set({ analysis: item, steps: item.agentSteps, phase: 'ready', error: null });
      },

      removeHistory: (id) => {
        set((state) => ({ history: state.history.filter((item) => item.id !== id) }));
      },

      reset: () => set({ analysis: null, steps: [], phase: 'idle', error: null, notice: null }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'evidenceflow-analysis',
      version: 1,
      partialize: (state) => ({ history: state.history }),
    },
  ),
);
