import { z } from "zod";
import { createHash } from "node:crypto";
import type { Database } from "./client";
import { candidates,collectionKinds,fingerprint,isCollectionKey,projectedEntry,type EntryRow,type CollectionKey } from "./collections-model";
import { imageMime,MAX_PHOTO_BYTES } from "./media";
import { importBookInTransaction,validateBookAsset } from "./book";

const account=z.enum(["ana","pedro"]);
const entry=z.object({id:z.uuid(),collection:z.string(),group_key:z.string(),author_id:account,data:z.record(z.string(),z.unknown()),fingerprint:z.string(),original_author:z.string().nullable(),created_at:z.string(),updated_at:z.string()});
const media=z.object({id:z.uuid(),author_id:account,mime:z.string(),caption:z.string().max(2000),date:z.string().max(10),sha256:z.string(),created_at:z.string(),import_key:z.string().nullable(),base64:z.string()});
const archive=z.object({id:z.uuid(),author_id:account,key:z.string().max(150),value:z.unknown(),fingerprint:z.string(),created_at:z.string()});
const schema=z.object({type:z.literal("nossa-historia-database-backup"),version:z.union([z.literal(1),z.literal(2)]),entries:z.array(entry).max(50000),media:z.array(media).max(10000),flags:z.array(z.object({key:z.string().regex(/^([0-9]|[1-5][0-9])$/),done:z.boolean(),updated_by:account})).max(60),archive:z.array(archive).max(10000),book:z.unknown().optional(),bookAssets:z.array(z.object({path:z.string(),mime:z.string(),sha256:z.string(),base64:z.string()})).max(1000).default([])});
export async function exportBackup(db:Database){
 return db.transaction(async(tx)=>{
  await tx.query("SELECT key FROM nh_collections ORDER BY key FOR SHARE");
  // Manter metadados e bytes das fotos no mesmo retrato do banco.
  await tx.query("LOCK TABLE nh_media,nh_legacy_archive,nh_book,nh_book_assets IN SHARE MODE");
  const entries=await tx.query<EntryRow&{created_at:Date;updated_at:Date}>("SELECT * FROM nh_entries ORDER BY ordinal");
  const photos=await tx.query<Record<string,unknown>&{bytes:Uint8Array;created_at:Date}>("SELECT * FROM nh_media ORDER BY created_at,id");
  const flags=await tx.query("SELECT key,done,updated_by FROM nh_flags ORDER BY key");
  const archives=await tx.query<Record<string,unknown>&{created_at:Date}>("SELECT * FROM nh_legacy_archive ORDER BY created_at,id");
  const book=await tx.query<{data:unknown}>("SELECT data FROM nh_book WHERE id='primary'");
  const bookAssets=await tx.query<{path:string;mime:string;sha256:string;bytes:Uint8Array}>("SELECT * FROM nh_book_assets ORDER BY path");
  return{type:"nossa-historia-database-backup",version:2,created:new Date().toISOString(),book:book.rows[0]?.data||null,bookAssets:bookAssets.rows.map(({bytes,...row})=>({...row,base64:Buffer.from(bytes).toString("base64")})),entries:entries.rows.map(({...row})=>({...row,created_at:new Date(row.created_at).toISOString(),updated_at:new Date(row.updated_at).toISOString()})),media:photos.rows.map(({bytes,...row})=>({...row,created_at:new Date(row.created_at).toISOString(),base64:Buffer.from(bytes).toString("base64")})),flags:flags.rows,archive:archives.rows.map((row)=>({...row,created_at:new Date(row.created_at).toISOString()}))};
 });
}
export async function restoreBackup(db:Database,input:unknown){
 const data=schema.parse(input);
 return db.transaction(async(tx)=>{
  await tx.query("SELECT key FROM nh_collections ORDER BY key FOR UPDATE");
  await tx.query("LOCK TABLE nh_book,nh_book_assets IN EXCLUSIVE MODE");
  const bookAssets=data.bookAssets.map(({base64,...row})=>({...row,bytes:Buffer.from(base64,"base64")}));
  bookAssets.forEach(validateBookAsset);
  if(!data.book&&bookAssets.length)throw new Error("Backup com arquivos sem livro.");
  const book=data.book?await importBookInTransaction(tx,data.book,bookAssets):{book:0,assets:0};
  let entries=0,photos=0,flags=0,archives=0;const changed=new Set<CollectionKey>();
  for(const row of data.entries){
   if(!isCollectionKey(row.collection)||collectionKinds[row.collection]==="flags")throw new Error("Conjunto inválido no backup.");
   const key=row.collection;const projected=projectedEntry(row as EntryRow);
   const candidate=candidates(key,["book","answers"].includes(collectionKinds[key])?{[row.group_key]:[projected]}:[projected])[0];
   if(fingerprint(candidate.group,candidate.data)!==row.fingerprint)throw new Error("Registro alterado no backup.");
   const duplicate=await tx.query("SELECT id FROM nh_entries WHERE collection=$1 AND author_id=$2 AND fingerprint=$3",[key,row.author_id,row.fingerprint]);if(duplicate.rows.length)continue;
   const result=await tx.query("INSERT INTO nh_entries(id,collection,group_key,author_id,data,fingerprint,original_author,created_at,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id",[row.id,key,row.group_key,row.author_id,JSON.stringify(candidate.data),row.fingerprint,row.original_author,row.created_at,row.updated_at]);if(result.rows.length){entries++;changed.add(key);}
  }
  for(const row of data.media){const bytes=Buffer.from(row.base64,"base64");if(bytes.length>MAX_PHOTO_BYTES||imageMime(bytes)!==row.mime||createHash("sha256").update(bytes).digest("hex")!==row.sha256)throw new Error("Foto inválida ou alterada no backup.");const result=await tx.query("INSERT INTO nh_media(id,author_id,mime,bytes,caption,date,sha256,created_at,import_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id",[row.id,row.author_id,row.mime,bytes,row.caption,row.date,row.sha256,row.created_at,row.import_key]);photos+=result.rows.length;}
  for(const row of data.flags){const result=await tx.query("INSERT INTO nh_flags(key,done,updated_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key",[row.key,row.done,row.updated_by]);if(result.rows.length){flags++;changed.add("nossa-historia-desafios-v1");}}
  for(const row of data.archive){const result=await tx.query("INSERT INTO nh_legacy_archive(id,author_id,key,value,fingerprint,created_at) VALUES($1,$2,$3,$4::jsonb,$5,$6) ON CONFLICT DO NOTHING RETURNING id",[row.id,row.author_id,row.key,JSON.stringify(row.value),row.fingerprint,row.created_at]);archives+=result.rows.length;}
  for(const key of changed)await tx.query("UPDATE nh_collections SET revision=revision+1 WHERE key=$1",[key]);
  return{entries,photos,flags,archives,books:book.book,bookAssets:book.assets};
 });
}
