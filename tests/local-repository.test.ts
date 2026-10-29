import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalRepository, isEntryMap, StorageFailure, type KeyValueStorage } from "../src/lib/storage/local-repository";

function fixture(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("book", initial);
  const storage: KeyValueStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  let notifications = 0;
  const repository = createLocalRepository("book", {}, isEntryMap, () => storage, () => { notifications++; });
  return { repository, values, notifications: () => notifications };
}

test("preserva registros do formato anterior e lê a versão mais recente antes de atualizar", () => {
  const original = { "Ana|day": [{ text: "Primeira página", date: "2025-10-25T12:00:00Z" }] };
  const { repository, values } = fixture(JSON.stringify(original));
  assert.deepEqual(repository.read(), original);
  values.set("book", JSON.stringify({ ...original, "Pedro|dreams": [{ text: "Uma viagem", date: "2026-01-01" }] }));
  repository.update((current) => ({ ...current, "Nós|dreams": [{ text: "Um lar", date: "2026-01-02" }] }));
  assert.deepEqual(Object.keys(repository.read()).sort(), ["Ana|day", "Pedro|dreams", "Nós|dreams"].sort());
});
test("não sobrescreve JSON corrompido ou registros com formato inesperado", () => {
  for (const raw of ["{corrompido", '{"Ana|day":"texto"}', '{"Ana|day":[{"text":123,"date":"ontem"}]}']) {
    const { repository, values, notifications } = fixture(raw);
    assert.throws(() => repository.update(() => ({})), StorageFailure);
    assert.equal(values.get("book"), raw); assert.equal(notifications(), 0);
  }
});
test("erro de quota não é apresentado como gravação bem sucedida", () => {
  const storage = { getItem: () => null, setItem() { throw new DOMException("Quota", "QuotaExceededError"); } };
  let notified = false;
  const repository = createLocalRepository("book", {}, isEntryMap, () => storage, () => { notified = true; });
  assert.throws(() => repository.update(() => ({ "Ana|day": [{ text: "Texto", date: "2026-10-25" }] })), /Não foi possível guardar/);
  assert.equal(notified, false);
});
test("edição de um caderno não altera os registros das outras pessoas", () => {
  const { repository } = fixture();
  repository.update(() => ({ "Ana|day": [{ text: "A", date: "2026-10-25" }], "Pedro|day": [{ text: "P", date: "2026-10-25" }] }));
  repository.update((current) => ({ ...current, "Ana|day": [] }));
  assert.equal(repository.read()["Pedro|day"][0].text, "P");
});
