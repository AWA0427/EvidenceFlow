import { create } from 'zustand';

export interface AuthUser {
  username: string;
  displayName: string;
  role: 'reviewer' | 'user';
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  check: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  check: async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) return;
      const json = (await response.json()) as { user?: AuthUser | null };
      set({ user: json.user ?? null });
    } catch {
      // 离线时保持游客状态
    }
  },

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = (await response.json()) as { ok?: boolean; user?: AuthUser; error?: string };
      if (!response.ok || !json.ok) {
        set({ loading: false, error: json.error || '登录失败，请检查账号和密码' });
        return false;
      }
      set({ user: json.user ?? { username, displayName: username, role: 'user' }, loading: false, error: null });
      return true;
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '登录失败，请稍后再试' });
      return false;
    }
  },

  register: async (username, password, displayName) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName }),
      });
      const json = (await response.json()) as { ok?: boolean; user?: AuthUser; error?: string };
      if (!response.ok || !json.ok) {
        set({ loading: false, error: json.error || '注册失败，请检查填写内容' });
        return false;
      }
      set({ user: json.user ?? null, loading: false, error: null });
      return true;
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '注册失败，请稍后再试' });
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      set({ user: null, error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
