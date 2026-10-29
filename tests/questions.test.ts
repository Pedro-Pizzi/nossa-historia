import assert from "node:assert/strict";
import { test } from "node:test";
import { isAnswers, mergeAnswers } from "../src/features/questions/model";

test("importação mantém registros, aceita perguntas de coração e evita duplicatas", () => {
  const entry = { author: "Ana" as const, text: "Uma resposta", date: "2025-10-25T12:00:00Z" };
  const current = { d1: [entry] };
  const incoming = { d1: [entry, { ...entry, author: "Pedro" }], c22: [entry], unknown: [entry] };
  const first = mergeAnswers(current, incoming, new Set(["d1", "c22"]));
  assert.equal(first.added, 2); assert.equal(first.answers.d1.length, 2); assert.equal(first.answers.c22.length, 1);
  assert.equal(first.answers.unknown, undefined); assert.equal(current.d1.length, 1);
  assert.equal(mergeAnswers(first.answers, incoming, new Set(["d1", "c22"])).added, 0);
});
test("importação ignora autores e datas inválidos sem descartar respostas existentes", () => {
  const entry = { author: "Ana" as const, text: "Original", date: "2026-10-25" };
  const result = mergeAnswers({ d1: [entry] }, { d1: [{ ...entry, author: "Outra pessoa" }, { ...entry, date: "inválida" }, { text: "sem campos" }] }, new Set(["d1"]));
  assert.equal(result.added, 0); assert.deepEqual(result.answers.d1, [entry]);
});
test("HTML em respostas continua sendo texto de usuário", () => {
  const incoming = { d1: [{ author: "Pedro", text: '<script>alert("teste")</script>', date: "2026-10-25" }] };
  assert.ok(isAnswers(incoming));
  assert.equal(mergeAnswers({}, incoming, new Set(["d1"])).answers.d1[0].text, incoming.d1[0].text);
});

test("importação pela interface da conta não atribui novas respostas à outra pessoa", () => {
  const incoming = { d1: [{ author: "Ana", text: "A", date: "2026-10-25" }, { author: "Pedro", text: "P", date: "2026-10-25" }] };
  const result = mergeAnswers({}, incoming, new Set(["d1"]), "Pedro");
  assert.equal(result.added, 1);
  assert.equal(result.answers.d1[0].author, "Pedro");
});
