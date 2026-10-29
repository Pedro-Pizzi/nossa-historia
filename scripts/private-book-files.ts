import { readFile } from "node:fs/promises";
import path from "node:path";
import { assetPath,parseBook } from "../src/lib/database/book-model";
import type { BookAsset } from "../src/lib/database/book";

export async function privateBookFiles(){
 let raw:string;
 try{raw=await readFile("content/private/book.json","utf8");}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}
 const book=parseBook(JSON.parse(raw));
 const manifest=JSON.parse(await readFile("content/legacy/manifest.json","utf8")) as{media:{file:string;mime:string;sha256:string}[]};
 const assets:BookAsset[]=[];
 for(const item of manifest.media){if(!assetPath.test(item.file))throw Error("Caminho de mídia inválido.");assets.push({path:item.file,mime:item.mime,sha256:item.sha256,bytes:await readFile(path.join("content/legacy",item.file))});}
 return{book,assets};
}
