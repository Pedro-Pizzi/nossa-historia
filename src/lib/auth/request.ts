export function trustedOrigin(request: Request, origin: string) {
  const site = request.headers.get("sec-fetch-site");
  return request.headers.get("origin") === origin && (!site || site === "same-origin" || site === "none");
}
export async function readLoginBody(request: Request): Promise<{ username: string; password: string } | null> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json" || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!value || typeof value !== "object" || !("username" in value) || !("password" in value) || typeof value.username !== "string" || typeof value.password !== "string" || value.username.length > 80 || !value.password.length || value.password.length > 128) return null;
    return { username: value.username, password: value.password };
  } catch { return null; }
  finally { reader.releaseLock(); }
}
export const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive", "Vary": "Cookie" };
