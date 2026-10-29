import assert from "node:assert/strict";
import { test } from "node:test";
import { genericTestBook } from "../scripts/test-book";
import { parseBook } from "../src/lib/database/book-model";
import { validateBookAsset } from "../src/lib/database/book";
test("livro recusa scripts, eventos, HTML bruto e imagens externas antes de renderizar",()=>{
 const {book}=genericTestBook();
 for(const injected of [{tag:"script",props:{},children:[]},{tag:"img",props:{src:"https://example.org/foto.jpg"},children:[]},{tag:"section",props:{id:"opening",onClick:"alert(1)"},children:[]},{tag:"section",props:{id:"opening",dangerouslySetInnerHTML:{__html:"<script>"}},children:[]}]){
  const data=structuredClone(book);data.chapters.opening=injected as unknown as typeof data.chapters.opening;assert.throws(()=>parseBook(data));
 }
});
test("mídia original exige assinatura, checksum e nome imutável correspondentes",()=>{
 const {assets}=genericTestBook();validateBookAsset(assets[0]);
 assert.throws(()=>validateBookAsset({...assets[0],bytes:Buffer.from("corrompido")}));
 assert.throws(()=>validateBookAsset({...assets[0],path:"assets/"+"a".repeat(64)+".png"}));
});
