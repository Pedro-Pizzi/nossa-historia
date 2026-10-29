import { createHash } from "node:crypto";
import { validPasswordHash } from "./password";
import type { Person } from "@/features/shared/types";

export type AccountId = "ana" | "pedro";
export interface Account { id: AccountId; name: Person; passwordHash: string; version: string; }
export interface AuthConfig { origin: string; secret: string; secure: boolean; accounts: [Account, Account]; }
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export function readAuthConfiguration(env: Record<string, string | undefined>): AuthConfig | null {
  const secret = env.AUTH_SESSION_SECRET;
  const ana = env.AUTH_ANA_PASSWORD_HASH;
  const pedro = env.AUTH_PEDRO_PASSWORD_HASH;
  if (!secret || Buffer.byteLength(secret) < 32 || !ana || !pedro || !validPasswordHash(ana) || !validPasswordHash(pedro) || !env.AUTH_ORIGIN) return null;
  let url: URL;
  try { url = new URL(env.AUTH_ORIGIN); } catch { return null; }
  if (url.origin !== env.AUTH_ORIGIN || url.username || url.password) return null;
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
  const postgres = env.DATABASE_MODE === "postgres" && !!env.DATABASE_URL;
  const embedded = local && env.DATABASE_MODE === "pglite" && !!env.DATABASE_PATH;
  if (!postgres && !embedded) return null;
  const account = (id: AccountId, name: Person, passwordHash: string): Account => ({ id, name, passwordHash, version: createHash("sha256").update(passwordHash).digest("hex") });
  return { origin: url.origin, secret, secure: env.NODE_ENV === "production" || url.protocol === "https:", accounts: [account("ana", "Ana", ana), account("pedro", "Pedro", pedro)] };
}
