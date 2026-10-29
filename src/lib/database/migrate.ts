import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Database } from "./client";

export async function migrate(database: Database) {
  const migrations = ["001_initial.sql", "002_private_book.sql"];
  const scripts = await Promise.all(migrations.map(file => readFile(path.join(process.cwd(), "database/migrations", file), "utf8")));
  await database.transaction(async (tx) => {
    await tx.query("CREATE TABLE IF NOT EXISTS nh_schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    await tx.query("LOCK TABLE nh_schema_migrations IN EXCLUSIVE MODE");
    for (const [index, sql] of scripts.entries()) {
    const version=index+1;
    const done = await tx.query("SELECT version FROM nh_schema_migrations WHERE version=$1",[version]);
    if (!done.rows.length) {
      // Uma instrução por vez funciona tanto no PostgreSQL TCP quanto no PGlite.
      for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) await tx.query(statement);
      await tx.query("INSERT INTO nh_schema_migrations(version) VALUES($1)",[version]);
    }
    }
  });
}
