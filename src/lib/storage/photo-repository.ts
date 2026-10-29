import type { SavedPhoto } from "@/features/shared/types";

export const PHOTO_EVENT = "nossa-historia:photos";
let connection: Promise<IDBDatabase> | undefined;
function database() {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("nossa-historia-momentos-v1", 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("photos")) request.result.createObjectStore("photos", { keyPath: "id", autoIncrement: true }); };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); connection = undefined; }; resolve(db); };
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => { connection = undefined; reject(new Error("Feche outras abas do livro para atualizar a galeria.")); };
  });
  return connection;
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", mode);
    const request = action(tx.objectStore("photos"));
    // Só confirmar a gravação depois do commit da transação.
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || new Error("A gravação foi cancelada."));
  });
}
export const photoRepository = {
  async list(): Promise<SavedPhoto[]> { return transaction("readonly", (store) => store.getAll()); },
  async add(photo: Omit<SavedPhoto, "id">) {
    const result = await transaction("readwrite", (store) => store.add(photo));
    window.dispatchEvent(new Event(PHOTO_EVENT)); return result;
  },
  async remove(id: number) {
    await transaction("readwrite", (store) => store.delete(id));
    window.dispatchEvent(new Event(PHOTO_EVENT));
  },
};
