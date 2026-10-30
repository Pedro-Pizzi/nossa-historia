import assert from "node:assert/strict";
import { test } from "node:test";
import { DraftGuard } from "../src/lib/storage/use-draft-guard";

test("resposta de salvamento atrasada preserva a nova edição e o rascunho local", async () => {
  const guard = new DraftGuard();
  let text = "Página enviada", persistedDraft = text;
  const clear = guard.capture();
  let finish!: () => void;
  const saved = new Promise<void>(resolve => { finish = resolve; });
  const saving = saved.then(() => clear(() => { text = ""; persistedDraft = ""; }));
  text = "Próxima página ainda não enviada";
  persistedDraft = text;
  guard.edit();
  finish();
  await saving;
  assert.equal(text, "Próxima página ainda não enviada");
  assert.equal(persistedDraft, text);
});

test("rascunho sem alterações é limpo somente uma vez após confirmação", () => {
  const guard = new DraftGuard();
  let clearCount = 0;
  const clear = guard.capture();
  clear(() => clearCount++);
  clear(() => clearCount++);
  assert.equal(clearCount, 1);
});

test("alterar qualquer campo preserva todo o formulário", () => {
  const guard = new DraftGuard();
  const form = { title: "Um marco", text: "Nossa lembrança", date: "2026-10-30" };
  const clear = guard.capture();
  form.title = "Título editado durante o envio";
  guard.edit();
  clear(() => { form.title = ""; form.text = ""; form.date = ""; });
  assert.equal(form.title, "Título editado durante o envio");
  assert.equal(form.text, "Nossa lembrança");
});
