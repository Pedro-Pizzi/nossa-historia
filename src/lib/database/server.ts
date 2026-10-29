import "server-only";
import { createDatabase, type Database } from "./client";

const runtime = globalThis as typeof globalThis & { __nhDatabase?: Promise<Database> };
export function databaseConfigured(env: Record<string, string | undefined> = process.env) {
  return (env.DATABASE_MODE === "postgres" && !!env.DATABASE_URL) || (env.DATABASE_MODE === "pglite" && !!env.DATABASE_PATH);
}
export function getDatabase() {
  if (!runtime.__nhDatabase) {
    runtime.__nhDatabase = createDatabase(process.env).then(async (db) => {
      try { const result=await db.query("SELECT version FROM nh_schema_migrations WHERE version=2"); if(!result.rows.length)throw new Error("Migração pendente.");return db; }
      catch { await db.close(); throw new Error("O banco ainda não está disponível ou precisa de migração."); }
    }).catch((error) => { runtime.__nhDatabase = undefined; throw error; });
  }
  return runtime.__nhDatabase;
}
