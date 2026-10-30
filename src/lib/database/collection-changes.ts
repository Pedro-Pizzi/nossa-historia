import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AccountId } from "../auth/config";
import type { Database } from "./client";
import { candidates, canWriteGroup, collectionKinds, DataError, fingerprint, personName, projectedEntry, type CollectionKey, type EntryRow } from "./collections-model";
import type { CollectionDelta } from "../storage/collection-changes";

const entryChange = z.object({ group: z.string().max(100), entry: z.record(z.string(), z.unknown()) }).strict();
export const collectionChangesSchema = z.object({
  revision: z.number().int().nonnegative(),
  add: z.array(entryChange).max(5000),
  update: z.array(entryChange.extend({ entry: z.record(z.string(), z.unknown()).refine(entry => z.uuid().safeParse(entry.id).success) })).max(5000),
  remove: z.array(z.uuid()).max(5000),
  flags: z.record(z.string().regex(/^([0-9]|[1-5][0-9])$/), z.boolean().nullable()),
}).strict();

export async function patchCollection(db: Database, actor: AccountId, key: CollectionKey, input: z.infer<typeof collectionChangesSchema>): Promise<CollectionDelta> {
  return db.transaction(async tx => {
    const locked = await tx.query<{ revision: number }>("SELECT revision FROM nh_collections WHERE key=$1 FOR UPDATE", [key]);
    const revision = locked.rows[0]?.revision;
    if (revision === undefined) throw new DataError(503, "O banco precisa ser preparado antes de guardar os registros.");
    if (revision !== input.revision) throw new DataError(409, "Há registros mais recentes. Confira a atualização e tente guardar novamente.");
    const result: CollectionDelta = { revision, upsert: [], remove: [], flags: {} };
    let changed = false;
    if (collectionKinds[key] === "flags") {
      if (input.add.length || input.update.length || input.remove.length) throw new DataError(400, "Alteração incompatível com este conjunto.");
      for (const [id, done] of Object.entries(input.flags)) {
        if (done === null) {
          const deleted = await tx.query("DELETE FROM nh_flags WHERE key=$1 RETURNING key", [id]);
          changed ||= deleted.rows.length > 0;
        } else {
          const saved = await tx.query("INSERT INTO nh_flags(key,done,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET done=excluded.done,updated_by=excluded.updated_by,updated_at=now() WHERE nh_flags.done IS DISTINCT FROM excluded.done RETURNING key", [id, done, actor]);
          changed ||= saved.rows.length > 0;
        }
        result.flags[id] = done;
      }
    } else {
      if (Object.keys(input.flags).length) throw new DataError(400, "Alteração incompatível com este conjunto.");
      const ids = [...input.update.map(item => item.entry.id as string), ...input.remove];
      if (new Set(ids).size !== ids.length) throw new DataError(400, "Identificador repetido.");
      const existing = ids.length ? await tx.query<EntryRow>("SELECT * FROM nh_entries WHERE collection=$1 AND id=ANY($2::uuid[])", [key, ids]) : { rows: [] };
      const byId = new Map(existing.rows.map(row => [row.id, row]));
      for (const id of ids) {
        const old = byId.get(id);
        if (!old) throw new DataError(404, "Registro não encontrado.");
        if (old.author_id !== actor || !canWriteGroup(actor, key, old.group_key)) throw new DataError(403, "Você só pode alterar ou apagar os registros que escreveu.");
      }
      const grouped = collectionKinds[key] === "book" || collectionKinds[key] === "answers";
      for (const [items, updating] of [[input.add, false], [input.update, true]] as const) {
        for (const item of items) {
          if (!grouped && item.group !== "") throw new DataError(400, "Grupo não reconhecido.");
          const entry = candidates(key, grouped ? { [item.group]: [item.entry] } : [item.entry])[0];
          if (!canWriteGroup(actor, key, entry.group) || (entry.declaredAuthor && entry.declaredAuthor !== personName(actor))) throw new DataError(403, "Escreva usando a sua própria conta.");
          const data = JSON.stringify(entry.data), digest = fingerprint(entry.group, entry.data);
          const saved = updating
            ? await tx.query<EntryRow>("UPDATE nh_entries SET group_key=$1,data=$2::jsonb,fingerprint=$3,original_author=NULL,updated_at=now() WHERE id=$4 AND collection=$5 RETURNING *", [entry.group, data, digest, entry.id, key])
            : await tx.query<EntryRow>("INSERT INTO nh_entries(id,collection,group_key,author_id,data,fingerprint) VALUES($1,$2,$3,$4,$5::jsonb,$6) RETURNING *", [randomUUID(), key, entry.group, actor, data, digest]);
          result.upsert.push({ group: entry.group, entry: projectedEntry(saved.rows[0]) });
          changed = true;
        }
      }
      if (input.remove.length) {
        await tx.query("DELETE FROM nh_entries WHERE collection=$1 AND id=ANY($2::uuid[])", [key, input.remove]);
        result.remove = input.remove;
        changed = true;
      }
    }
    if (changed) {
      result.revision++;
      await tx.query("UPDATE nh_collections SET revision=$1 WHERE key=$2", [result.revision, key]);
    }
    return result;
  });
}
