import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceName = "Nossa Historia";
const source = await readFile(path.join(root, sourceName), "utf8");
const output = path.join(root, "content", "legacy");
try {
  await access(path.join(output, "manifest.json"));
  throw new Error("O acervo já existe. A extração é inicial e não sobrescreve conteúdo editado.");
} catch (error) { if (error.code !== "ENOENT") throw error; }

const hash = (data) => createHash("sha256").update(data).digest("hex");
const files = new Map();
const media = new Map();
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "audio/mpeg": "mp3", "video/mp4": "mp4", "audio/ogg": "ogg", "audio/wav": "wav" };
let mediaOccurrences = 0;

let document = source.replace(/data:([\w.+/-]+);base64,([A-Za-z0-9+/=]+)/g, (_, mime, base64) => {
  if (!extensions[mime]) throw new Error(`Formato de mídia desconhecido: ${mime}`);
  const buffer = Buffer.from(base64, "base64");
  const checksum = hash(buffer);
  const file = `assets/${checksum}.${extensions[mime]}`;
  files.set(file, buffer);
  media.set(file, { file, mime, bytes: buffer.length, sha256: checksum });
  mediaOccurrences++;
  return `/acervo/${file}`;
});

let styleCount = 0;
let scriptCount = 0;
const inactiveScripts = [];
document = document.replace(/<(style|script)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi, (tag, kind, attributes, code) => {
  if (kind.toLowerCase() === "style") {
    const file = `styles/style-${String(++styleCount).padStart(2, "0")}.css`;
    files.set(file, Buffer.from(code));
    return `<link rel="stylesheet" href="/acervo/${file}">`;
  }
  const external = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (external) {
    // O original só referencia uma tentativa de integração Supabase incompleta.
    // Guardar o inventário, sem chamar CDN ou arquivos que não existem.
    if (!["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", "./cloud-config.js", "./cloud-sync.js"].includes(external)) throw new Error(`Script externo não inventariado: ${external}`);
    inactiveScripts.push(external);
    return "<!-- Integração antiga inativa: ver manifest.json e docs/arquitetura.md. -->";
  }
  const file = `scripts/script-${String(++scriptCount).padStart(2, "0")}.js`;
  files.set(file, Buffer.from(code));
  return `<script${attributes} src="/acervo/${file}"></script>`;
});

files.set("document.html", Buffer.from(document));
const inventory = [...files].map(([file, buffer]) => ({ file, bytes: buffer.length, sha256: hash(buffer) }));
const manifest = {
  source: sourceName,
  sourceBytes: Buffer.byteLength(source),
  sourceSha256: hash(Buffer.from(source)),
  files: [...files.keys()].sort(),
  inventory,
  media: [...media.values()],
  mediaOccurrences,
  styles: styleCount,
  scripts: scriptCount,
  inactiveScripts,
  extractedBytes: inventory.reduce((sum, item) => sum + item.bytes, 0),
};

for (const [file, buffer] of files) {
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await writeFile(path.join(output, file), buffer);
}
await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ styles: styleCount, scripts: scriptCount, mediaOccurrences, uniqueMedia: media.size, sourceBytes: manifest.sourceBytes, extractedBytes: manifest.extractedBytes }, null, 2));
