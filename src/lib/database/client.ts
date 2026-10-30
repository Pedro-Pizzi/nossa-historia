import { Pool } from "pg";
import path from "node:path";
import { X509Certificate } from "node:crypto";

export interface SqlExecutor { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>; }
export interface Database extends SqlExecutor { transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>; close(): Promise<void>; }

export async function createDatabase(env: Record<string, string | undefined>): Promise<Database> {
  if (env.DATABASE_MODE === "pglite") {
    if (!env.DATABASE_PATH) throw new Error("Configure o caminho do banco local.");
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = await PGlite.create(path.resolve(env.DATABASE_PATH));
    return {
      async query<T>(sql: string, params: unknown[] = []) { return { rows: (await pg.query<T>(sql, params)).rows }; },
      transaction(work) { return pg.transaction((tx) => work({ async query<T>(sql: string, params: unknown[] = []) { return { rows: (await tx.query<T>(sql, params)).rows }; } })); },
      close: () => pg.close(),
    };
  }
  if (env.DATABASE_MODE !== "postgres" || !env.DATABASE_URL) throw new Error("Configure um banco de dados antes de liberar o acesso.");
  const url = new URL(env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("A conexão deve ser PostgreSQL.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // Remover opções da URI que poderiam substituir a verificação TLS explícita.
  for (const name of ["sslmode", "sslcert", "sslkey", "sslrootcert", "ssl"]) url.searchParams.delete(name);
  const pinned=env.DATABASE_SSL_CERT?new X509Certificate(env.DATABASE_SSL_CERT.replace(/\\n/g,"\n")):undefined;
  const ca=env.DATABASE_SSL_CA?.replace(/\\n/g,"\n");
  const pool = new Pool({ connectionString: url.toString(), max: 4, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, statement_timeout: 15000, ssl: local && env.NODE_ENV !== "production" ? false : { rejectUnauthorized: true, ...(pinned?{ca:ca||pinned.toString(),checkServerIdentity:(_hostname:string,certificate:{fingerprint256?:string})=>certificate.fingerprint256===pinned.fingerprint256?undefined:new Error("O certificado do banco não corresponde ao configurado.")}:ca ? { ca } : {}) } });
  pool.on("error", () => { /* Não registrar URI, credenciais ou conteúdo pessoal. */ });
  return {
    async query<T>(sql: string, params: unknown[] = []) { return { rows: (await pool.query(sql, params)).rows as T[] }; },
    async transaction(work) { const connection = await pool.connect(); try { await connection.query("BEGIN"); const result = await work({ async query<T>(sql: string, params: unknown[] = []) { return { rows: (await connection.query(sql, params)).rows as T[] }; } }); await connection.query("COMMIT"); return result; } catch (error) { await connection.query("ROLLBACK"); throw error; } finally { connection.release(); } },
    close: () => pool.end(),
  };
}
