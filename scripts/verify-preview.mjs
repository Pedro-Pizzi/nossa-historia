import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const production = process.argv.includes("--production");
const base = production ? "http://127.0.0.1:3001" : "http://127.0.0.1:3000";
const root = await fetch(base, { redirect: "manual" });
assert.equal(root.status, 307); assert.equal(root.headers.get("location"), "/login");
const login = await fetch(base + "/login");
assert.equal(login.status, 200);
const html = await login.text();
assert.ok(!html.includes("Não sei se vamos comprar a casa agora"));
const manifest = JSON.parse(await readFile("content/legacy/manifest.json", "utf8"));
for (const file of ["document.html", "styles/style-01.css", "scripts/script-01.js", manifest.media[0].file, "manifest.json"]) assert.equal((await fetch(`${base}/acervo/${file}`)).status, 401, file);
assert.equal((await fetch(base + "/api/auth/session")).status, 401);
if (production) {
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await inspect(file);
      else if (/\.(js|json|map|html|txt)$/.test(entry.name)) {
        const content = await readFile(file, "utf8");
        assert.ok(!content.includes("Não sei se vamos comprar a casa agora"), `Texto pessoal em arquivo público: ${file}`);
        assert.ok(!content.includes("61b5642eb4c67434c44a94890e7df6b5031acac1631c9a34b6abb853876a0703"), `Foto pessoal referenciada em arquivo público: ${file}`);
      }
    }
  }
  await inspect(".next/static");
}
console.log(`${production ? "Produção local" : "Desenvolvimento"}: entrada pública disponível; livro, sessão e acervo protegidos. Para testar as duas contas e o conteúdo, execute pnpm build e pnpm verify:auth.`);
