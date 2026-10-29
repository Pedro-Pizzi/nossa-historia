import type { AccountId } from "./config";

export interface SessionRecord { id: string; accountId: AccountId; accountVersion: string; issuedAt: number; expiresAt: number; }
export interface AttemptResult { allowed: boolean; retryAfter: number; }
export interface AuthStore {
  createSession(record: SessionRecord): void | Promise<void>;
  findSession(id: string, now?: number): SessionRecord | null | Promise<SessionRecord | null>;
  revokeSession(id: string): void | Promise<void>;
  consumeAttempt(account: string, now?: number): AttemptResult | Promise<AttemptResult>;
  clearAttempts(account: string): void | Promise<void>;
}
const WINDOW_MS = 15 * 60 * 1000;
export class MemoryAuthStore implements AuthStore {
  private sessions = new Map<string, SessionRecord>();
  private attempts = new Map<string, { count: number; until: number }>();
  createSession(record: SessionRecord) {
    for (const [id, session] of this.sessions) if (session.expiresAt <= record.issuedAt) this.sessions.delete(id);
    const existing = [...this.sessions.values()].filter((session) => session.accountId === record.accountId).sort((a, b) => a.issuedAt - b.issuedAt);
    while (existing.length >= 5) this.sessions.delete(existing.shift()!.id);
    this.sessions.set(record.id, { ...record });
  }
  findSession(id: string, now = Date.now()) {
    const session = this.sessions.get(id);
    if (!session || session.expiresAt <= now) { this.sessions.delete(id); return null; }
    return { ...session };
  }
  revokeSession(id: string) { this.sessions.delete(id); }
  consumeAttempt(account: string, now = Date.now()): AttemptResult {
    const key = account === "ana" || account === "pedro" ? account : "unknown";
    let bucket = this.attempts.get(key);
    if (!bucket || bucket.until <= now) { bucket = { count: 0, until: now + WINDOW_MS }; this.attempts.set(key, bucket); }
    if (bucket.count >= 5) return { allowed: false, retryAfter: Math.ceil((bucket.until - now) / 1000) };
    bucket.count++;
    return { allowed: true, retryAfter: 0 };
  }
  clearAttempts(account: string) { this.attempts.delete(account); }
}
