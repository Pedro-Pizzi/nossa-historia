import { authenticate } from "@/lib/auth/service";
import { getAuthConfig, getAuthStore, getSession } from "@/lib/auth/server";
import { privateHeaders, readLoginBody, trustedOrigin } from "@/lib/auth/request";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const config = getAuthConfig();
  if (!config) return Response.json({ message: "O acesso ainda não foi liberado." }, { status: 503, headers: privateHeaders });
  if (!trustedOrigin(request, config.origin)) return new Response(null, { status: 403, headers: privateHeaders });
  const credentials = await readLoginBody(request);
  if (!credentials) return Response.json({ message: "Verifique o usuário e a senha." }, { status: 400, headers: privateHeaders });
  try {
    const store = await getAuthStore();
    const result = await authenticate(config, store, credentials.username, credentials.password);
    if (!result.ok) return Response.json({ message: result.status === 429 ? "Muitas tentativas. Aguarde alguns minutos e tente novamente." : "Verifique o usuário e a senha." }, { status: result.status, headers: { ...privateHeaders, ...(result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {}) } });
    const session = await getSession(config);
    // Ao entrar novamente, revogar a sessão anterior e emitir uma identidade nova.
    if (session.sessionId) await store.revokeSession(session.sessionId);
    session.sessionId = result.record.id;
    try { await session.save(); }
    catch (error) { await store.revokeSession(result.record.id); throw error; }
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch {
    return Response.json({ message: "Não foi possível entrar agora. Tente novamente." }, { status: 503, headers: privateHeaders });
  }
}
