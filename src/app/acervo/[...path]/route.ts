import { readLegacyAsset } from "@/lib/server/legacy";
import { currentAccount } from "@/lib/auth/server";
import { privateHeaders } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!(await currentAccount())) return new Response(null, { status: 401, headers: privateHeaders });

  const { path } = await context.params;
  // O HTML e os scripts de referência não fazem parte da aplicação autenticada.
  if (path[0] !== "styles" && path[0] !== "assets") return new Response(null, { status: 404, headers: privateHeaders });
  const asset = await readLegacyAsset(path);
  if (!asset) return new Response(null, { status: 404, headers: privateHeaders });

  return new Response(new Uint8Array(asset.body), {
    headers: {
      "Content-Type": asset.contentType,
      ...privateHeaders,
    },
  });
}
