import { createHash } from "node:crypto";
import { privateBookFiles } from "./private-book-files";
import { chapterIds,parseBook } from "../src/lib/database/book-model";
/** Fixture genérica quando o checkout público não tem o pacote privado. */
export async function testBook(){
 const original=await privateBookFiles();if(original)return original;
 return genericTestBook();
}
export function genericTestBook(){
 const bytes=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC2kAAAAASUVORK5CYII=","base64");
 const sha256=createHash("sha256").update(bytes).digest("hex"),file=`assets/${sha256}.png`,url=`/acervo/${file}`;
 const chapters=Object.fromEntries(chapterIds.map(id=>[id,{tag:"section",props:{id,className:id==="opening"?"screen":"page"},children:[{tag:"h2",props:{},children:[`Capítulo de teste: ${id}`]},{tag:"img",props:{src:url,alt:"Imagem de teste"},children:[]},{slot:true}]}]));
 return{book:parseBook({version:1,chapters,catalog:{questionSections:[],challenges:[],bookIcons:{Ana:url,Pedro:url,"Nós":url},favoriteIcons:{},heartIntro:{title:"Perguntas",description:"Fixture de teste"}}}),assets:[{path:file,mime:"image/png",bytes,sha256}]};
}
