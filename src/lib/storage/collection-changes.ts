export interface EntryChange { group: string; entry: Record<string, unknown>; }
export interface CollectionChanges {
  add: EntryChange[];
  update: EntryChange[];
  remove: string[];
  flags: Record<string, boolean | null>;
}
export interface CollectionDelta {
  revision: number;
  upsert: EntryChange[];
  remove: string[];
  flags: Record<string, boolean | null>;
}

export function collectionShape(key: string) {
  if (key === "nossa-historia-desafios-v1") return "flags";
  return key === "nossa-historia-tres-diarios-v1" || key === "nossa-historia-descobertas-v1" ? "grouped" : "list";
}

function entries(key: string, value: unknown): EntryChange[] {
  const groups = collectionShape(key) === "grouped" ? Object.entries(value as Record<string, unknown[]>) : [["", value]] as [string, unknown[]][];
  return groups.flatMap(([group, items]) => items.map(entry => ({ group, entry: entry as Record<string, unknown> })));
}

/** Enviar somente os registros alterados, independentemente do tamanho do acervo. */
export function collectionChanges(key: string, previous: unknown, next: unknown): CollectionChanges {
  const changes: CollectionChanges = { add: [], update: [], remove: [], flags: {} };
  if (collectionShape(key) === "flags") {
    const before = previous as Record<string, boolean>, after = next as Record<string, boolean>;
    for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (before[id] !== after[id]) changes.flags[id] = after[id] ?? null;
    }
    return changes;
  }
  const before = new Map(entries(key, previous).map(item => [item.entry.id, item]));
  const seen = new Set<unknown>();
  for (const item of entries(key, next)) {
    const old = before.get(item.entry.id);
    if (!old) changes.add.push(item);
    else {
      if (seen.has(item.entry.id)) throw new Error("Identificador repetido.");
      seen.add(item.entry.id);
      if (old.group !== item.group || JSON.stringify(old.entry) !== JSON.stringify(item.entry)) changes.update.push(item);
    }
  }
  for (const [id] of before) {
    if (typeof id !== "string") throw new Error("Não foi possível identificar os registros salvos.");
    if (!seen.has(id)) changes.remove.push(id);
  }
  return changes;
}

/** Aplicar os IDs e a autoria canônicos retornados pelo servidor sem baixar tudo novamente. */
export function applyCollectionDelta(key: string, value: unknown, delta: CollectionDelta): unknown {
  if (!Number.isInteger(delta.revision) || !Array.isArray(delta.upsert) || !Array.isArray(delta.remove) || !delta.flags || typeof delta.flags !== "object") throw new Error("Resposta de salvamento inválida.");
  if (collectionShape(key) === "flags") {
    const result = { ...value as Record<string, boolean> };
    for (const [id, done] of Object.entries(delta.flags)) {
      if (done === null) delete result[id];
      else result[id] = done;
    }
    return result;
  }
  const updates = new Map(delta.upsert.map(item => {
    if (!item.entry || typeof item.entry.id !== "string" || typeof item.group !== "string") throw new Error("Registro salvo inválido.");
    return [item.entry.id, item] as const;
  }));
  const removed = new Set(delta.remove);
  const result: EntryChange[] = [];
  for (const item of entries(key, value)) {
    const id = item.entry.id as string;
    if (removed.has(id)) continue;
    const updated = updates.get(id);
    if (updated?.group === item.group) { result.push(updated); updates.delete(id); }
    else if (!updated) result.push(item);
  }
  result.push(...updates.values());
  if (collectionShape(key) === "list") return result.map(item => item.entry);
  const grouped: Record<string, unknown[]> = {};
  for (const item of result) (grouped[item.group] ??= []).push(item.entry);
  return grouped;
}
