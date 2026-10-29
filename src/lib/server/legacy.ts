import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDatabase } from "@/lib/database/server";
import { assetPath } from "@/lib/database/book-model";

/** Apenas CSS do sistema em disco; imagens pessoais são lidas do banco. */
export async function readLegacyAsset(segments:string[]){
 const file=segments.join("/");
 if(/^styles\/style-0[1-9]\.css$/.test(file))return {body:await readFile(path.join(process.cwd(),"content/legacy",file)),contentType:"text/css; charset=utf-8"};
 if(!assetPath.test(file))return null;
 const result=await(await getDatabase()).query<{bytes:Uint8Array;mime:string}>("SELECT bytes,mime FROM nh_book_assets WHERE path=$1",[file]);
 return result.rows.length?{body:result.rows[0].bytes,contentType:result.rows[0].mime}:null;
}
