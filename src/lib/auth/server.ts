import "server-only";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { readAuthConfiguration, SESSION_TTL_SECONDS, type AuthConfig } from "./config";
import { PostgresAuthStore } from "@/lib/database/auth-store";
import { getDatabase } from "@/lib/database/server";
import { authorizedAccount } from "./service";

export interface SessionData { sessionId: string; }
export async function getAuthStore() { return new PostgresAuthStore(await getDatabase()); }
export function getAuthConfig() { return readAuthConfiguration(process.env); }
export function getSession(config: AuthConfig) {
  return cookies().then((cookieStore) => getIronSession<SessionData>(cookieStore, {
    password: config.secret,
    cookieName: config.secure ? "__Host-nossa-historia" : "nossa-historia-local",
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: { httpOnly: true, sameSite: "strict", secure: config.secure, path: "/", maxAge: SESSION_TTL_SECONDS - 60 },
  }));
}
export async function currentAccount() {
  const config = getAuthConfig();
  if (!config) return null;
  const session = await getSession(config);
  if (!session.sessionId) return null;
  try { return await authorizedAccount(config, await getAuthStore(), session.sessionId); }
  catch { return null; } // Falha de conexão nunca libera acesso ou usa memória como fallback.
}
