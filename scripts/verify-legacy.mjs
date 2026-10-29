import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "content", "legacy");
const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
const hash = (data) => createHash("sha256").update(data).digest("hex");
for (const entry of manifest.inventory) {
  const buffer = await readFile(path.join(directory, entry.file));
  assert.equal(hash(buffer), entry.sha256, `Arquivo alterado desde a extração: ${entry.file}`);
}
let source;
try { source = await readFile(path.join(root, manifest.source)); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (source) {
  assert.equal(hash(source), manifest.sourceSha256, "O arquivo original foi alterado.");
  // Reconstruir o HTML completo, incluindo ordem dos blocos e mídia embutida,
  // para comprovar a preservação de cada byte do documento original.
  let reconstructed = await readFile(path.join(directory, "document.html"), "utf8");
  const mediaData = [];
  for (const entry of manifest.media) {
    const buffer = await readFile(path.join(directory, entry.file));
    mediaData.push([`/acervo/${entry.file}`, `data:${entry.mime};base64,${buffer.toString("base64")}`]);
  }
  const restoreMedia = (text) => {
    for (const [url, data] of mediaData) if (text.includes(url)) text = text.replaceAll(url, data);
    return text;
  };
  reconstructed = restoreMedia(reconstructed);
  const original = source.toString("utf8");
  let styles = 0, scripts = 0;
  for (const match of original.matchAll(/<(style|script)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
    if (/\bsrc\s*=/.test(match[2])) {
      reconstructed = reconstructed.replace("<!-- Integração antiga inativa: ver manifest.json e docs/arquitetura.md. -->", () => match[0]);
      continue;
    }
    const kind = match[1].toLowerCase();
    const file = kind === "style" ? `styles/style-${String(++styles).padStart(2,"0")}.css` : `scripts/script-${String(++scripts).padStart(2,"0")}.js`;
    const code = restoreMedia(await readFile(path.join(directory, file), "utf8"));
    assert.equal(code, match[3], `Conteúdo original não preservado: ${file}`);
    const replacement = kind === "style"
      ? `<link rel="stylesheet" href="/acervo/${file}">`
      : `<script${match[2]} src="/acervo/${file}"></script>`;
    reconstructed = reconstructed.replace(replacement, () => match[0]);
  }
  assert.equal(hash(reconstructed), hash(original), "O HTML reconstruído difere do original.");
}
for (const file of manifest.files) await access(path.join(directory, file));
console.log(`Acervo íntegro: ${manifest.styles} estilos, ${manifest.scripts} scripts e ${manifest.media.length} mídias únicas. Original ${source ? "preservado e conferido" : "não disponível neste checkout"}.`);
