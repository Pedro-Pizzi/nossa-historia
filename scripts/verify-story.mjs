import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "parse5";

export async function verifyStoryHtml(html) {
  const attr = (node, key) => node.attrs?.find((attribute) => attribute.name === key)?.value;
  const all = (node) => [node, ...(node.childNodes || []).flatMap(all)];
  const text = (node) => node.nodeName === "#text" ? node.value : (node.childNodes || []).map(text).join("");
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  const nodes = all(parse(html));
  let original,migration;
  try{original=all(parse(await readFile("content/legacy/document.html","utf8")));migration=JSON.parse(await readFile("content/story/migration.json","utf8"));}
  catch(error){if(error.code!=="ENOENT")throw error;for(const id of ["opening","carta","memorias","diario","perguntas","sonhos","biblioteca","acolhimento","encontros","escolha","marcos","checkin","lembrar","neste-dia","final"])assert.ok(nodes.some(node=>attr(node,"id")===id));assert.equal(nodes.filter(node=>node.tagName==="iframe").length,0);assert.ok(!html.includes("/acervo/scripts/"));return "15 capítulos da fixture pública";}
  const ids = nodes.map((node) => attr(node, "id")).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, "Há IDs duplicados no React.");
  for (const chapter of migration.chapterFiles) assert.ok(ids.includes(chapter.id), chapter.id);
  assert.equal(nodes.filter((node) => node.tagName === "iframe").length, 0);
  assert.ok(!html.includes("/acervo/scripts/"));
  assert.equal(nodes.filter((node) => node.tagName === "button" && (attr(node, "aria-controls") || "").startsWith("love-")).length, migration.questions);
  assert.equal(nodes.filter((node) => (attr(node, "id") || "").startsWith("challenge-idea-")).length, migration.challenges);
  assert.equal(nodes.filter((node) => node.tagName === "button" && (attr(node, "aria-label") || "").startsWith("Ampliar foto:")).length, migration.photos.length);
  const preserved = original.filter((node) => ["h1", "h2", "figcaption"].includes(node.tagName) || (attr(node, "class") || "").split(" ").some((name) => ["lead", "memory-intro", "notebook-intro", "cover-v10-letter-lead"].includes(name)));
  for (const id of ["opening-letter-v10", "carta", "final"]) {
    const chapter = original.find((node) => attr(node, "id") === id);
    preserved.push(...all(chapter).filter((node) => node.tagName === "p"));
  }
  const rendered = normalize(text(parse(html)));
  for (const node of preserved) assert.ok(rendered.includes(normalize(text(node))), `Texto não preservado: ${normalize(text(node)).slice(0, 90)}`);
  return `${migration.chapterFiles.length} capítulos, ${migration.questions} perguntas, ${migration.challenges} encontros, ${migration.photos.length} fotos e ${preserved.length} blocos de texto`;
}
