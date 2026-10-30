import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createDatabase, type Database } from "../src/lib/database/client";
import { migrate } from "../src/lib/database/migrate";
import { readCollection } from "../src/lib/database/collections";
import { collectionChangesSchema, patchCollection } from "../src/lib/database/collection-changes";
import { importLegacy } from "../src/lib/database/import-legacy";
import { applyCollectionDelta, collectionChanges } from "../src/lib/storage/collection-changes";

let db: Database, directory: string;
const book = "nossa-historia-tres-diarios-v1", notes = "nossa-historia-convites-v1", flags = "nossa-historia-desafios-v1";
const entry = (text: string) => ({ text, date: "2026-10-30" });
const patch = (revision: number, changes: Partial<ReturnType<typeof collectionChanges>> = {}) => collectionChangesSchema.parse({ revision, add: [], update: [], remove: [], flags: {}, ...changes });
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "nh-patch-test-"));
  db = await createDatabase({ DATABASE_MODE: "pglite", DATABASE_PATH: directory });
  await migrate(db);
});
after(async () => {
  await db?.close();
  if (directory) {
    const relative = path.relative(tmpdir(), directory);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !path.basename(directory).startsWith("nh-patch-test-")) throw new Error("Diretório de teste inesperado.");
    await rm(directory, { recursive: true });
  }
});

test("coleção acima de 2 MiB aceita inclusão, edição e exclusão com mensagens pequenas", async () => {
  const records = Array.from({ length: 1000 }, (_, index) => entry(String(index).padStart(4, "0") + "a".repeat(1996)));
  const imported = await importLegacy(db, "ana", book, { "Ana|day": records });
  assert.equal(imported.added, 1000);
  let state = await readCollection(db, book);
  assert.ok(Buffer.byteLength(JSON.stringify(state)) > 2 * 1024 * 1024);
  const previous = state.value as Record<string, Record<string, unknown>[]>;
  const next = { ...previous, "Ana|day": [...previous["Ana|day"], entry("Mais uma página")] };
  const request = patch(state.revision, collectionChanges(book, previous, next));
  assert.ok(Buffer.byteLength(JSON.stringify(request)) < 1024);
  const added = await patchCollection(db, "ana", book, request);
  assert.ok(Buffer.byteLength(JSON.stringify(added)) < 1024);
  assert.equal(added.upsert[0].entry.author, "Ana");
  state = { revision: added.revision, value: applyCollectionDelta(book, previous, added) };
  assert.deepEqual(state, await readCollection(db, book));

  const current = state.value as Record<string, Record<string, unknown>[]>;
  const last = current["Ana|day"].at(-1)!;
  const edited = { ...current, "Ana|day": [...current["Ana|day"].slice(0, -1), { ...last, text: "Página revisada" }] };
  const updated = await patchCollection(db, "ana", book, patch(state.revision, collectionChanges(book, current, edited)));
  state = { revision: updated.revision, value: applyCollectionDelta(book, state.value, updated) };
  assert.deepEqual(state, await readCollection(db, book));

  const remove = patch(state.revision, collectionChanges(book, state.value, previous));
  assert.ok(Buffer.byteLength(JSON.stringify(remove)) < 1024);
  const deleted = await patchCollection(db, "ana", book, remove);
  state = { revision: deleted.revision, value: applyCollectionDelta(book, state.value, deleted) };
  assert.deepEqual(state.value, previous);
  assert.deepEqual(state, await readCollection(db, book));
});

test("operações por registro mantêm autoria, isolamento, conflitos e rollback atômico", async () => {
  const state = await readCollection(db, notes);
  const added = await patchCollection(db, "ana", notes, patch(state.revision, { add: [{ group: "", entry: entry("Convite da Ana") }] }));
  const saved = added.upsert[0].entry;
  await assert.rejects(() => patchCollection(db, "pedro", notes, patch(added.revision, { remove: [saved.id as string] })), /só pode alterar ou apagar/);
  await assert.rejects(() => patchCollection(db, "pedro", notes, patch(added.revision, { update: [{ group: "", entry: { ...saved, text: "Outra autoria" } }] })), /só pode alterar ou apagar/);
  await assert.rejects(() => patchCollection(db, "ana", notes, patch(state.revision)), /mais recentes/);
  const before = await readCollection(db, notes);
  await assert.rejects(() => patchCollection(db, "ana", notes, patch(before.revision, { add: [{ group: "", entry: entry("Deve ser revertido") }, { group: "", entry: { ...entry("Falsa autoria"), author: "Pedro" } }] })), /própria conta/);
  assert.deepEqual(await readCollection(db, notes), before);
  const bookState = await readCollection(db, book);
  await assert.rejects(() => patchCollection(db, "ana", book, patch(bookState.revision, { remove: [saved.id as string] })), /não encontrado/);
  await assert.rejects(() => patchCollection(db, "ana", book, patch(bookState.revision, { add: [{ group: "Pedro|day", entry: entry("Não pode") }] })), /própria conta/);
  await assert.rejects(() => patchCollection(db, "ana", notes, patch(before.revision, { remove: [saved.id as string, saved.id as string] })), /repetido/);
  await assert.rejects(() => patchCollection(db, "ana", notes, patch(before.revision, { remove: [randomUUID()] })), /não encontrado/);
  const deleted = await patchCollection(db, "ana", notes, patch(before.revision, { remove: [saved.id as string] }));
  assert.deepEqual(applyCollectionDelta(notes, before.value, deleted), []);
});

test("desafios enviam somente as marcações alteradas e preservam o controle de revisão", async () => {
  let state = await readCollection(db, flags);
  const first = await patchCollection(db, "ana", flags, patch(state.revision, collectionChanges(flags, state.value, { "0": true, "1": false })));
  state = { revision: first.revision, value: applyCollectionDelta(flags, state.value, first) };
  assert.deepEqual(state, await readCollection(db, flags));
  const changes = collectionChanges(flags, state.value, { "1": true });
  assert.deepEqual(changes.flags, { "0": null, "1": true });
  const second = await patchCollection(db, "pedro", flags, patch(state.revision, changes));
  assert.deepEqual(applyCollectionDelta(flags, state.value, second), { "1": true });
  assert.equal((await patchCollection(db, "ana", flags, patch(second.revision))).revision, second.revision);
  await assert.rejects(() => patchCollection(db, "ana", flags, patch(state.revision)), /mais recentes/);
});
