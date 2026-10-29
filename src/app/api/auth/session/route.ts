import { currentAccount } from "@/lib/auth/server";
import { privateHeaders } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const account = await currentAccount();
  if (!account) return new Response(null, { status: 401, headers: privateHeaders });
  return Response.json({ id: account.id, name: account.name }, { headers: privateHeaders });
}
