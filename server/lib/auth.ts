import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';

/**
 * 真实登录系统（轻量版）：
 * - 用户存在 data/users.json，密码用 scrypt + 随机盐哈希，不存明文；
 * - 登录/注册都由服务端校验；
 * - 会话用随机 token + HttpOnly Cookie，服务端内存保存；
 * - 不依赖数据库，适合比赛演示，也方便后续换成 SQLite/Postgres。
 */

const SESSION_COOKIE = 'ef_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

interface UserRecord {
  username: string;
  displayName: string;
  salt: string;
  hash: string;
  role: 'reviewer' | 'user';
  createdAt: string;
}

interface Session {
  user: AuthUser;
  expiresAt: number;
}

export interface AuthUser {
  username: string;
  displayName: string;
  role: 'reviewer' | 'user';
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

const sessions = new Map<string, Session>();

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readUsers(): UserRecord[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as UserRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: UserRecord[]): void {
  ensureDataDir();
  const temp = `${USERS_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(temp, USERS_FILE);
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function publicUser(record: UserRecord): AuthUser {
  return {
    username: record.username,
    displayName: record.displayName,
    role: record.role,
  };
}

function seedReviewUser(users: UserRecord[]): void {
  const username = process.env.REVIEW_USERNAME?.trim() || 'judge';
  if (users.some((user) => user.username === username)) return;
  const password = process.env.REVIEW_PASSWORD?.trim() || 'evidence2026';
  if (!password) return;
  const salt = crypto.randomBytes(16).toString('hex');
  users.push({
    username,
    displayName: '评审老师',
    salt,
    hash: hashPassword(password, salt),
    role: 'reviewer',
    createdAt: new Date().toISOString(),
  });
  writeUsers(users);
}

// 启动时确保演示账号存在；密码只存哈希。
try {
  const users = readUsers();
  seedReviewUser(users);
} catch {
  // 只读文件系统下仍允许内存演示
}

export function authRequired(): boolean {
  return process.env.AUTH_REQUIRED === 'true';
}

export function verifyUser(username: string, password: string): AuthUser | null {
  const users = readUsers();
  const record = users.find((user) => user.username.toLowerCase() === username.trim().toLowerCase());
  if (!record) return null;
  const candidate = hashPassword(password, record.salt);
  if (!safeEqualHex(candidate, record.hash)) return null;
  return publicUser(record);
}

export function registerUser(input: {
  username: string;
  password: string;
  displayName?: string;
}): AuthUser {
  const username = input.username.trim();
  const password = input.password;
  const displayName = (input.displayName || username).trim().slice(0, 20);

  if (!/^1[3-9]\d{9}$/.test(username)) {
    throw new AuthError('请输入 11 位手机号。');
  }
  if (password.length < 6 || password.length > 64) {
    throw new AuthError('密码需 6–64 位。');
  }
  if (!displayName) {
    throw new AuthError('显示名称不能为空。');
  }

  const users = readUsers();
  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    throw new AuthError('这个账号已被注册。', 409);
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const record: UserRecord = {
    username,
    displayName,
    salt,
    hash: hashPassword(password, salt),
    role: 'user',
    createdAt: new Date().toISOString(),
  };
  users.push(record);
  writeUsers(users);
  return publicUser(record);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(value);
      } catch {
        result[key] = value;
      }
    }
  }
  return result;
}

export function createSession(user: AuthUser): { token: string; cookie: string } {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  return {
    token,
    cookie: `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`,
  };
}

export function clearSessionCookie(): string {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function currentUser(req: Request): AuthUser | null {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.user;
}

export function destroySession(req: Request): void {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) sessions.delete(token);
}

export function demoAccountHint(): { username: string; password: string } | null {
  if (process.env.REVIEW_PASSWORD?.trim()) return null;
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE === 'false') return null;
  return { username: 'judge', password: 'evidence2026' };
}
