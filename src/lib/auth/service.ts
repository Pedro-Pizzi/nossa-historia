import { randomUUID } from "node:crypto";
import { SESSION_TTL_SECONDS, type AuthConfig, type Account } from "./config";
import { verifyPassword } from "./password";
import type { AuthStore, SessionRecord } from "./store";

export type LoginResult = { ok: true; account: Account; record: SessionRecord } | { ok: false; status: 401 | 429; retryAfter?: number };
export async function authenticate(config: AuthConfig, store: AuthStore, username: string, password: string, now = Date.now()): Promise<LoginResult> {
  const normalized = username.trim().toLowerCase();
  const attempt = await store.consumeAttempt(normalized, now);
  if (!attempt.allowed) return { ok: false, status: 429, retryAfter: attempt.retryAfter };
  const account = config.accounts.find((candidate) => candidate.id === normalized);
  const valid = await verifyPassword(password, account?.passwordHash);
  if (!valid || !account) return { ok: false, status: 401 };
  const record: SessionRecord = { id: randomUUID(), accountId: account.id, accountVersion: account.version, issuedAt: now, expiresAt: now + SESSION_TTL_SECONDS * 1000 };
  await store.clearAttempts(normalized);
  await store.createSession(record);
  return { ok: true, account, record };
}

export async function authorizedAccount(config: AuthConfig, store: AuthStore, sessionId: unknown, now = Date.now()): Promise<Account | null> {
  if (typeof sessionId !== "string" || !/^[a-f0-9-]{36}$/.test(sessionId)) return null;
  const session = await store.findSession(sessionId, now);
  if (!session) return null;
  const account = config.accounts.find((candidate) => candidate.id === session.accountId && candidate.version === session.accountVersion);
  if (!account) { await store.revokeSession(sessionId); return null; }
  return account;
}
