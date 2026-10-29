import { createHash } from "node:crypto";
import type { Database,SqlExecutor } from "./client";
import { assetPath,bookHash,parseBook,type PrivateBook } from "./book-model";
import { imageMime } from "./media";
export interface BookAsset{path:string;mime:string;bytes:Uint8Array;sha256:string}
export function validateBookAsset(asset:BookAsset){
 if(!assetPath.test(asset.path)||asset.bytes.length>20*1024*1024||imageMime(Buffer.from(asset.bytes))!==asset.mime)throw Error("Arquivo do livro inválido.");
 const sha=createHash("sha256").update(asset.bytes).digest("hex");
 if(sha!==asset.sha256||!asset.path.startsWith(`assets/${sha}.`))throw Error("Arquivo do livro alterado.");
}
function imageReferences(book:PrivateBook){const result=new Set<string>();const walk=(value:unknown)=>{if(typeof value==="string"&&value.startsWith("/acervo/assets/"))result.add(value.slice("/acervo/".length));else if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==="object")Object.values(value).forEach(walk);};walk(book);return result;}
export async function importBookInTransaction(tx:SqlExecutor,input:unknown,assets:BookAsset[]){
 const book=parseBook(input);const sha=bookHash(book);
 const existing=await tx.query<{sha256:string}>("SELECT sha256 FROM nh_book WHERE id='primary'");
 if(existing.rows.length&&existing.rows[0].sha256!==sha)throw Error("Já existe outro livro. O importador não sobrescreve conteúdo.");
 const available=new Set((await tx.query<{path:string}>("SELECT path FROM nh_book_assets")).rows.map(row=>row.path));
 let addedAssets=0;
 for(const asset of assets){validateBookAsset(asset);const result=await tx.query("INSERT INTO nh_book_assets(path,mime,bytes,sha256) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING path",[asset.path,asset.mime,Buffer.from(asset.bytes),asset.sha256]);addedAssets+=result.rows.length;available.add(asset.path);}
 for(const reference of imageReferences(book))if(!available.has(reference))throw Error("Imagem do livro ausente.");
 const result=await tx.query("INSERT INTO nh_book(id,data,sha256) VALUES('primary',$1::jsonb,$2) ON CONFLICT DO NOTHING RETURNING id",[JSON.stringify(book),sha]);
 return{book:result.rows.length,assets:addedAssets};
}
export async function importBook(db:Database,input:unknown,assets:BookAsset[]){return db.transaction(async tx=>{await tx.query("LOCK TABLE nh_book,nh_book_assets IN EXCLUSIVE MODE");return importBookInTransaction(tx,input,assets);});}
export async function readBook(db:SqlExecutor){const result=await db.query<{data:unknown}>("SELECT data FROM nh_book WHERE id='primary'");return result.rows.length?parseBook(result.rows[0].data):null;}
