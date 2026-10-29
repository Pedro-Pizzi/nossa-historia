import type { Database } from "./client";
import type { AuthStore, SessionRecord } from "../auth/store";

export class PostgresAuthStore implements AuthStore {
  constructor(private database: Database) {}
  async createSession(record: SessionRecord) {
    await this.database.transaction(async (tx) => {
      await tx.query("SELECT id FROM nh_accounts WHERE id=$1 FOR UPDATE", [record.accountId]);
      await tx.query("DELETE FROM nh_sessions WHERE expires_at <= $1", [record.issuedAt]);
      const previous = await tx.query<{ id: string }>("SELECT id FROM nh_sessions WHERE account_id=$1 ORDER BY issued_at DESC,id DESC", [record.accountId]);
      for (const entry of previous.rows.slice(4)) await tx.query("DELETE FROM nh_sessions WHERE id=$1", [entry.id]);
      await tx.query("INSERT INTO nh_sessions(id,account_id,account_version,issued_at,expires_at) VALUES($1,$2,$3,$4,$5)", [record.id,record.accountId,record.accountVersion,record.issuedAt,record.expiresAt]);
    });
  }
  async findSession(id: string, now = Date.now()) {
    const { rows } = await this.database.query<{ id: string; account_id: SessionRecord["accountId"]; account_version: string; issued_at: string; expires_at: string }>("SELECT * FROM nh_sessions WHERE id=$1 AND expires_at > $2", [id,now]);
    const entry = rows[0];
    return entry ? { id: entry.id, accountId: entry.account_id, accountVersion: entry.account_version, issuedAt: Number(entry.issued_at), expiresAt: Number(entry.expires_at) } : null;
  }
  async revokeSession(id: string) { await this.database.query("DELETE FROM nh_sessions WHERE id=$1", [id]); }
  async consumeAttempt(account: string, now = Date.now()) {
    const bucket = account === "ana" || account === "pedro" ? account : "unknown";
    const { rows } = await this.database.query<{ attempts: number; until_ms: string }>(`INSERT INTO nh_login_limits(bucket,attempts,until_ms) VALUES($1,1,$2)
      ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN nh_login_limits.until_ms <= $3 THEN 1 ELSE LEAST(nh_login_limits.attempts+1,6) END,
      until_ms=CASE WHEN nh_login_limits.until_ms <= $3 THEN $2 ELSE nh_login_limits.until_ms END RETURNING attempts,until_ms`, [bucket,now+900000,now]);
    return { allowed: rows[0].attempts <= 5, retryAfter: rows[0].attempts <= 5 ? 0 : Math.max(1,Math.ceil((Number(rows[0].until_ms)-now)/1000)) };
  }
  async clearAttempts(account: string) { await this.database.query("DELETE FROM nh_login_limits WHERE bucket=$1", [account]); }
}
