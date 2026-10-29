import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { photoRepository, PHOTO_EVENT } from "../src/lib/storage/photo-repository";

test("galeria mantém compatibilidade com o IndexedDB anterior e só confirma transações concluídas", async () => {
  const target = new EventTarget();
  Object.defineProperty(globalThis, "window", { value: target, configurable: true });
  let changes = 0;
  target.addEventListener(PHOTO_EVENT, () => changes++);
  // Criar pelo esquema antigo antes de acessar o novo repositório.
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("nossa-historia-momentos-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos", { keyPath: "id", autoIncrement: true });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("photos", "readwrite");
      tx.objectStore("photos").add({ blob: new Blob(["foto antiga"], { type: "image/jpeg" }), caption: "Original", date: "2023-10-25", created: "2023-10-25" });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  });
  const initial = await photoRepository.list();
  assert.equal(initial[0].caption, "Original");
  await photoRepository.add({ blob: new Blob(["foto nova"], { type: "image/png" }), caption: "Nova", date: "", created: "2026-10-25" });
  const photos = await photoRepository.list();
  assert.equal(photos.length, 2); assert.equal(await photos[0].blob.text(), "foto antiga"); assert.equal(changes, 1);
  await photoRepository.remove(photos[1].id);
  assert.equal((await photoRepository.list()).length, 1); assert.equal(changes, 2);
});
