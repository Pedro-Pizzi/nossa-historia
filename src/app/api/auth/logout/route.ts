import { getAuthConfig, getAuthStore, getSession } from "@/lib/auth/server";
import { privateHeaders, trustedOrigin } from "@/lib/auth/request";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const config = getAuthConfig();
  if (!config) return new Response(null, { status: 503, headers: privateHeaders });
  if (!trustedOrigin(request, config.origin)) return new Response(null, { status: 403, headers: privateHeaders });
  const session = await getSession(config);
  if (session.sessionId) await (await getAuthStore()).revokeSession(session.sessionId);
  session.destroy();
  return new Response(null, { status: 204, headers: privateHeaders });
}
