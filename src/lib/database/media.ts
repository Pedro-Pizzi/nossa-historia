import { createHash,randomUUID } from "node:crypto";
import type { Database } from "./client";
import type { AccountId } from "../auth/config";
import { DataError,personName } from "./collections-model";
export const MAX_PHOTO_BYTES=3*1024*1024;
export function imageMime(bytes:Buffer):string|null{
  if(bytes.length<12)return null;
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return"image/jpeg";
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return"image/png";
  if(["GIF87a","GIF89a"].includes(bytes.subarray(0,6).toString("ascii")))return"image/gif";
  if(bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP")return"image/webp";
  if(bytes.subarray(4,8).toString()==="ftyp"){
    const brands=bytes.subarray(8,Math.min(bytes.length,64)).toString("ascii");
    if(/avif|avis/.test(brands))return"image/avif";
    if(/heic|heix|hevc|hevx/.test(brands))return"image/heic";
    if(/mif1|msf1/.test(brands))return"image/heif";
  }
  return null;
}
export async function savePhoto(db:Database,actor:AccountId,bytes:Buffer,caption:string,date:string,importKey?:string){
  if(!bytes.length||bytes.length>MAX_PHOTO_BYTES)throw new DataError(413,"Escolha uma imagem de até 3 MB.");
  const mime=imageMime(bytes);if(!mime)throw new DataError(400,"O arquivo não é uma imagem compatível.");
  if(caption.length>2000||date.length>10||(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))throw new DataError(400,"Confira a legenda e a data.");
  const id=randomUUID(),sha=createHash("sha256").update(bytes).digest("hex");
  const key=importKey?createHash("sha256").update(sha+caption+date).digest("hex"):null;
  const result=await db.query<{id:string}>("INSERT INTO nh_media(id,author_id,mime,bytes,caption,date,sha256,import_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(import_key) DO NOTHING RETURNING id",[id,actor,mime,bytes,caption,date,sha,key]);
  return{added:result.rows.length===1,id:result.rows[0]?.id};
}
export async function listPhotos(db:Database){
  const {rows}=await db.query<{id:string;author_id:AccountId;mime:string;caption:string;date:string;created_at:Date}>("SELECT id,author_id,mime,caption,date,created_at FROM nh_media ORDER BY created_at,id");
  return rows.map((row)=>({id:row.id,author:personName(row.author_id),mime:row.mime,caption:row.caption,date:row.date,created:new Date(row.created_at).toISOString(),url:`/api/photos/${row.id}`}));
}
