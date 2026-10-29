import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { startAuthTestServer } from "./auth-test-server";
import { verifyStoryHtml } from "./verify-story.mjs";
import { testBook } from "./test-book";

async function main() {
  const content=await testBook();
  const mediaPath = "/acervo/" + content.assets[0].path;
  const privateText=JSON.stringify(content.book);
  const unconfigured = await startAuthTestServer({ configured: false });
  try {
    const root = await fetch(unconfigured.origin, { redirect: "manual" });
    assert.equal(root.status, 307); assert.equal(root.headers.get("location"), "/login");
    assert.equal((await fetch(unconfigured.origin + mediaPath)).status, 401);
    const disabled = await fetch(unconfigured.origin + "/api/auth/login", { method: "POST", headers: { origin: unconfigured.origin, "content-type": "application/json" }, body: JSON.stringify({ username: "ana", password: "qualquer senha de teste" }) });
    assert.equal(disabled.status, 503); assert.equal(disabled.headers.get("set-cookie"), null);
    console.log("Sem configuração: livro, mídia e login permanecem fechados.");
  } finally { await unconfigured.stop(); }

  const server = await startAuthTestServer();
  const base = server.origin;
  const post = (path: string, body?: unknown, cookie?: string, origin = base) => fetch(base + path, { method: "POST", headers: { origin, ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const protectedGet = (path: string, cookie?: string, headers?: Record<string, string>) => fetch(base + path, { redirect: "manual", headers: { ...(cookie ? { cookie } : {}), ...headers } });
  try {
    assert.equal((await protectedGet("/")).status, 307);
    assert.equal((await protectedGet("/api/auth/session")).status, 401, "Sessão sem cookie deve ser recusada.");
    for (const file of [mediaPath, "/acervo/styles/style-01.css", "/acervo/document.html", "/acervo/scripts/script-01.js", "/acervo/manifest.json"]) assert.equal((await protectedGet(file)).status, 401);
    assert.equal((await protectedGet("/", undefined, { RSC: "1", "Next-Router-Prefetch": "1" })).status, 307);
    const loginPage = await protectedGet("/login"); const loginHtml = await loginPage.text();
    assert.ok(loginHtml.includes("Entrar na nossa história")); assert.ok(!loginHtml.includes('cover-v10-letter-paper'));
    assert.equal((await post("/api/auth/login", { username: "ana", password: server.passwords.ana }, undefined, "https://outro.example")).status, 403);
    const wrong = await post("/api/auth/login", { username: "ana", password: "incorreta" });
    assert.equal(wrong.status, 401); assert.equal(wrong.headers.get("set-cookie"), null);
    const auth = await post("/api/auth/login", { username: "ana", password: server.passwords.ana });
    assert.equal(auth.status, 200);
    const setCookie = auth.headers.get("set-cookie")!;
    assert.ok(setCookie.includes("HttpOnly")); assert.ok(setCookie.includes("Secure")); assert.ok(/SameSite=Strict/i.test(setCookie)); assert.ok(setCookie.startsWith("__Host-"));
    const cookie = setCookie.split(";")[0];
    const root = await protectedGet("/", cookie); assert.equal(root.status, 200); assert.ok(root.headers.get("cache-control")?.includes("no-store"));
    const story = await root.text(); assert.ok(story.includes('id="opening"'));
    console.log("Conteúdo autenticado: " + await verifyStoryHtml(story) + " preservados.");
    const session = await protectedGet("/api/auth/session", cookie); assert.deepEqual(await session.json(), { id: "ana", name: "Ana" });
    const media = await protectedGet(mediaPath, cookie); assert.equal(media.status, 200); assert.ok(media.headers.get("cache-control")?.includes("no-store"));
    const optimizer = "/_next/image?url=" + encodeURIComponent(mediaPath) + "&w=640&q=75";
    assert.equal((await protectedGet(optimizer, cookie)).status, 404, "O otimizador não deve publicar cópias das fotos privadas.");
    assert.equal((await protectedGet(optimizer)).status, 404, "O otimizador não deve expor imagens sem sessão.");
    for (const file of ["/acervo/document.html", "/acervo/scripts/script-01.js", "/acervo/manifest.json", "/acervo/../package.json"]) assert.equal((await protectedGet(file, cookie)).status, 404);
    const split = cookie.indexOf("=") + 1;
    const position = split + 100;
    const tampered = cookie.slice(0, position) + (cookie[position] === "a" ? "b" : "a") + cookie.slice(position + 1);
    assert.equal((await protectedGet("/api/auth/session", tampered)).status, 401, "Cookie alterado deve ser recusado.");
    assert.equal((await post("/api/auth/logout", undefined, cookie, "https://outro.example")).status, 403);
    assert.equal((await protectedGet("/api/auth/session", cookie)).status, 200);
    assert.equal((await post("/api/auth/logout", undefined, cookie)).status, 204);
    assert.equal((await protectedGet("/api/auth/session", cookie)).status, 401, "Sessão revogada não pode ser reutilizada.");
    assert.equal((await protectedGet(mediaPath, cookie)).status, 401, "Mídia deve ser recusada após sair.");
    const pedro = await post("/api/auth/login", { username: "pedro", password: server.passwords.pedro }); assert.equal(pedro.status, 200);
    const pedroCookie = pedro.headers.get("set-cookie")!.split(";")[0];
    assert.deepEqual(await (await protectedGet("/api/auth/session", pedroCookie)).json(), { id: "pedro", name: "Pedro" });
    await verifyStoryHtml(await (await protectedGet("/", pedroCookie)).text());
    await post("/api/auth/logout", undefined, pedroCookie);
    for (let index = 0; index < 5; index++) assert.equal((await post("/api/auth/login", { username: "inventado-" + index, password: "incorreta" })).status, 401);
    const limited = await post("/api/auth/login", { username: "outro-inventado", password: "incorreta" });
    assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get("retry-after")) > 0);
    assert.equal((await protectedGet("/api/auth/signup")).status, 404);
    async function inspect(directory: string) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = `${directory}/${entry.name}`;
        if (entry.isDirectory()) await inspect(file);
        else if (/\.(js|map|json)$/.test(entry.name)) {
          const content = await readFile(file, "utf8");
          assert.ok(!content.includes(privateText), "Livro pessoal em arquivo público.");
          assert.ok(!content.includes(server.passwords.ana) && !content.includes(server.passwords.pedro), "Credencial em arquivo público.");
        }
      }
    }
    await inspect(".next/static");
    console.log("Autenticação: duas contas, cookies protegidos, conteúdo e fotos privados, RSC protegido, saída revogável, origem e limite de tentativas verificados em produção local.");
    console.log("Credenciais de teste descartadas; nenhuma configuração pessoal foi criada ou alterada.");
  } finally { await server.stop(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Falha na verificação de autenticação."); process.exitCode = 1; });
