import { randomUUID } from "node:crypto";
import type { Database, SqlExecutor } from "./client";
import type { AccountId } from "../auth/config";
import { candidates, canWriteGroup, collectionKinds, DataError, fingerprint, parseFlags, personName, projectedEntry, type CollectionKey, type EntryRow } from "./collections-model";

export interface Snapshot { revision: number; value: unknown; }
async function lock(tx: SqlExecutor, key: CollectionKey, mode: "SHARE" | "UPDATE") {
  const result = await tx.query<{revision:number}>(`SELECT revision FROM nh_collections WHERE key=$1 FOR ${mode}`,[key]);
  if (!result.rows[0]) throw new DataError(503,"O banco precisa ser preparado antes de guardar os registros.");
  return result.rows[0].revision;
}
export async function readInside(tx: SqlExecutor, key: CollectionKey, revision: number): Promise<Snapshot> {
  if (collectionKinds[key] === "flags") {
    const result = await tx.query<{key:string;done:boolean}>("SELECT key,done FROM nh_flags ORDER BY key");
    return { revision,value:Object.fromEntries(result.rows.map((row)=>[row.key,row.done])) };
  }
  const {rows} = await tx.query<EntryRow>("SELECT * FROM nh_entries WHERE collection=$1 ORDER BY ordinal",[key]);
  if (collectionKinds[key] === "book" || collectionKinds[key] === "answers") {
    const value: Record<string,unknown[]> = {};
    for (const row of rows) (value[row.group_key] ??= []).push(projectedEntry(row));
    return {revision,value};
  }
  return {revision,value:rows.map(projectedEntry)};
}
export function readCollection(db: Database,key: CollectionKey) { return db.transaction(async(tx)=>readInside(tx,key,await lock(tx,key,"SHARE"))); }

export async function writeCollection(db: Database,actor: AccountId,key: CollectionKey,expected: number,value: unknown) {
  return db.transaction(async(tx)=>{
    const revision = await lock(tx,key,"UPDATE");
    if (revision !== expected) throw new DataError(409,"Há registros mais recentes. Confira a atualização e tente guardar novamente.");
    let changed = false;
    if (collectionKinds[key] === "flags") {
      const next = parseFlags(value);
      const existing = await tx.query<{key:string;done:boolean}>("SELECT key,done FROM nh_flags");
      for (const row of existing.rows) if (!Object.hasOwn(next,row.key)) { await tx.query("DELETE FROM nh_flags WHERE key=$1",[row.key]); changed=true; }
      for (const [id,done] of Object.entries(next)) if (!existing.rows.some((row)=>row.key===id&&row.done===done)) {
        await tx.query("INSERT INTO nh_flags(key,done,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET done=excluded.done,updated_by=excluded.updated_by,updated_at=now()",[id,done,actor]); changed=true;
      }
    } else {
      const next = candidates(key,value);
      const {rows} = await tx.query<EntryRow>("SELECT * FROM nh_entries WHERE collection=$1",[key]);
      const existing = new Map(rows.map((row)=>[row.id,row]));
      const seen = new Set<string>();
      for (const entry of next) {
        if (entry.id && seen.has(entry.id)) throw new DataError(400,"Identificador repetido.");
        if (entry.id) seen.add(entry.id);
        const old = entry.id ? existing.get(entry.id) : undefined;
        if (old) {
          const same = old.group_key===entry.group && fingerprint(old.group_key,old.data)===fingerprint(entry.group,entry.data) && entry.declaredAuthor === (old.original_author || personName(old.author_id));
          if (same) continue;
          if (old.author_id !== actor || !canWriteGroup(actor,key,old.group_key) || !canWriteGroup(actor,key,entry.group) || entry.declaredAuthor !== personName(actor)) throw new DataError(403,"Você só pode alterar os registros que escreveu.");
          await tx.query("UPDATE nh_entries SET group_key=$1,data=$2::jsonb,fingerprint=$3,original_author=NULL,updated_at=now() WHERE id=$4",[entry.group,JSON.stringify(entry.data),fingerprint(entry.group,entry.data),old.id]); changed=true;
        } else {
          if (!canWriteGroup(actor,key,entry.group) || (entry.declaredAuthor && entry.declaredAuthor!==personName(actor))) throw new DataError(403,"Escreva usando a sua própria conta.");
          await tx.query("INSERT INTO nh_entries(id,collection,group_key,author_id,data,fingerprint) VALUES($1,$2,$3,$4,$5::jsonb,$6)",[randomUUID(),key,entry.group,actor,JSON.stringify(entry.data),fingerprint(entry.group,entry.data)]); changed=true;
        }
      }
      for (const old of rows) if (!seen.has(old.id)) {
        if (old.author_id!==actor || !canWriteGroup(actor,key,old.group_key)) throw new DataError(403,"Você só pode apagar os registros que escreveu.");
        await tx.query("DELETE FROM nh_entries WHERE id=$1",[old.id]); changed=true;
      }
    }
    const nextRevision = revision + (changed?1:0);
    if (changed) await tx.query("UPDATE nh_collections SET revision=$1 WHERE key=$2",[nextRevision,key]);
    return readInside(tx,key,nextRevision);
  });
}
