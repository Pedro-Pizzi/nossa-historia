/** Contrato local substituível por persistência no servidor na etapa do banco. */
export interface Repository<T> {
  read(): T;
  update(updater: (current: T) => T): T;
  subscribe(listener: () => void): () => void;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class StorageFailure extends Error {
  constructor(message: string, options?: ErrorOptions) { super(message, options); this.name = "StorageFailure"; }
}

export function createLocalRepository<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
  storage: () => KeyValueStorage = () => window.localStorage,
  notify: () => void = () => window.dispatchEvent(new CustomEvent("nossa-historia:changed", { detail: key })),
): Repository<T> {
  function read(): T {
    try {
      const raw = storage().getItem(key);
      if (raw === null) return structuredClone(initial);
      const value: unknown = JSON.parse(raw);
      if (!validate(value)) throw new Error("Formato inesperado");
      return value;
    } catch (cause) {
      throw new StorageFailure("Não foi possível ler os registros deste navegador. Os dados existentes foram mantidos.", { cause });
    }
  }
  return {
    read,
    update(updater) {
      // Ler novamente evita sobrescrever alterações de outro componente ou aba.
      const next = updater(read());
      if (!validate(next)) throw new StorageFailure("O registro não está em um formato válido.");
      try { storage().setItem(key, JSON.stringify(next)); }
      catch (cause) { throw new StorageFailure("Não foi possível guardar. Verifique o espaço e as permissões deste navegador.", { cause }); }
      notify();
      return next;
    },
    subscribe(listener) {
      const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener(); };
      const onLocal = (event: Event) => { if ((event as CustomEvent<string>).detail === key) listener(); };
      window.addEventListener("storage", onStorage);
      window.addEventListener("nossa-historia:changed", onLocal);
      return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("nossa-historia:changed", onLocal); };
    },
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isEntry(value: unknown): value is { text: string; date: string } {
  return isRecord(value) && typeof value.text === "string" && typeof value.date === "string";
}

export function isEntryMap(value: unknown): value is Record<string, { text: string; date: string }[]> {
  return isRecord(value) && Object.values(value).every((entries) => Array.isArray(entries) && entries.every(isEntry));
}
