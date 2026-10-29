import assert from "node:assert/strict";
import { test,before,after } from "node:test";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDatabase,type Database } from "../src/lib/database/client";
import { migrate } from "../src/lib/database/migrate";
import { readCollection,writeCollection } from "../src/lib/database/collections";
import { importLegacy } from "../src/lib/database/import-legacy";
import { PostgresAuthStore } from "../src/lib/database/auth-store";
import { randomUUID } from "node:crypto";
import { savePhoto,listPhotos } from "../src/lib/database/media";
import { exportBackup,restoreBackup } from "../src/lib/database/backup";
import { importBook,readBook } from "../src/lib/database/book";
import { genericTestBook } from "../scripts/test-book";
let database:Database,directory:string;
before(async()=>{directory=await mkdtemp(path.join(tmpdir(),"nh-db-test-"));database=await createDatabase({DATABASE_MODE:"pglite",DATABASE_PATH:directory});await migrate(database);});
after(async()=>{await database?.close();if(directory){const relative=path.relative(tmpdir(),directory);if(relative.startsWith("..")||path.isAbsolute(relative)||!path.basename(directory).startsWith("nh-db-test-"))throw new Error("Diretório de teste inesperado.");await rm(directory,{recursive:true});}});
const key="nossa-historia-tres-diarios-v1" as const;
test("registros persistem no banco e o servidor impede escrever ou apagar como a outra pessoa",async()=>{
 let state=await readCollection(database,key);
 state=await writeCollection(database,"ana",key,state.revision,{"Ana|day":[{text:"Página da Ana",date:"2026-10-25"}]});
 const value=state.value as Record<string,unknown[]>;
 await assert.rejects(()=>writeCollection(database,"pedro",key,state.revision,{}),/só pode apagar/);
 await assert.rejects(()=>writeCollection(database,"ana",key,state.revision,{...value,"Pedro|day":[{text:"Fingir ser Pedro",date:"2026-10-25"}]}),/própria conta/);
 const saved=await readCollection(database,key);assert.deepEqual(saved,state);
});
test("edições antigas recebem conflito sem sobrescrever o outro aparelho",async()=>{
 const state=await readCollection(database,key);const old=state.revision;
 await writeCollection(database,"pedro",key,old,{...(state.value as object),"Pedro|day":[{text:"Pedro",date:"2026-10-25"}]});
 await assert.rejects(()=>writeCollection(database,"ana",key,old,{}),/mais recentes/);
});
test("importação é repetível, não sobrescreve e não assume a autoria da outra pessoa",async()=>{
 const input={"Ana|dreams":[{text:"Sonho",date:"2026-10-25"}],"Pedro|dreams":[{text:"Sonho do Pedro",date:"2026-10-25"}]};
 const first=await importLegacy(database,"ana",key,input);assert.equal(first.added,1);assert.equal(first.skipped,1);
 const again=await importLegacy(database,"ana",key,input);assert.equal(again.added,0);assert.equal(again.duplicates,1);
});
test("sessões e limites são compartilhados entre instâncias do repositório",async()=>{
 const one=new PostgresAuthStore(database),two=new PostgresAuthStore(database),id=randomUUID();
 await one.createSession({id,accountId:"ana",accountVersion:"version",issuedAt:10,expiresAt:10000});
 assert.equal((await two.findSession(id,20))?.accountId,"ana");await two.revokeSession(id);assert.equal(await one.findSession(id,20),null);
 const attempts=await Promise.all(Array.from({length:8},()=>two.consumeAttempt("ana",1000)));assert.equal(attempts.filter((result)=>result.allowed).length,5);
});
test("fotos são guardadas no banco e importações repetidas não criam cópias",async()=>{
 const bytes=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC2kAAAAASUVORK5CYII=","base64");
 const first=await savePhoto(database,"ana",bytes,"Lembrança","2026-10-25","origem");assert.ok(first.added);
 assert.equal((await savePhoto(database,"pedro",bytes,"Lembrança","2026-10-25","outra-origem")).added,false);
 const photos=await listPhotos(database);assert.equal(photos.length,1);assert.equal(photos[0].author,"Ana");
 await assert.rejects(()=>savePhoto(database,"ana",Buffer.from("<html>isto não é uma imagem</html>"),"",""),/não é uma imagem/);
});
test("o mesmo banco pode ser fechado e reaberto sem perder registros ou sessões",async()=>{
 const id=randomUUID();await new PostgresAuthStore(database).createSession({id,accountId:"pedro",accountVersion:"v",issuedAt:10,expiresAt:10000});
 await database.close();database=await createDatabase({DATABASE_MODE:"pglite",DATABASE_PATH:directory});
 const state=await readCollection(database,key);assert.ok((state.value as Record<string,unknown[]>)["Ana|day"].length);
 assert.ok(await new PostgresAuthStore(database).findSession(id,20));
});
test("backup restaura por mesclagem, inclui fotos e não duplica nem sobrescreve",async()=>{
 const initialBook=genericTestBook();await importBook(database,initialBook.book,initialBook.assets);
 const backup=await exportBackup(database);
 const before=await readCollection(database,key);const photos=(await listPhotos(database)).length;
 const repeated=await restoreBackup(database,backup);assert.equal(repeated.entries,0);assert.equal(repeated.photos,0);assert.deepEqual(await readCollection(database,key),before);assert.equal((await listPhotos(database)).length,photos);
 const otherDirectory=await mkdtemp(path.join(tmpdir(),"nh-db-test-"));const other=await createDatabase({DATABASE_MODE:"pglite",DATABASE_PATH:otherDirectory});
 try{await migrate(other);const result=await restoreBackup(other,backup);assert.ok(result.entries>=3);assert.equal(result.photos,1);assert.equal((await listPhotos(other)).length,1);assert.equal(result.books,1);assert.deepEqual(await readBook(other),initialBook.book);}finally{await other.close();const relative=path.relative(tmpdir(),otherDirectory);if(relative.startsWith("..")||path.isAbsolute(relative)||!path.basename(otherDirectory).startsWith("nh-db-test-"))throw new Error("Diretório inesperado.");await rm(otherDirectory,{recursive:true});}
 const damaged=structuredClone(backup);damaged.media[0].base64=Buffer.from("arquivo corrompido").toString("base64");await assert.rejects(()=>restoreBackup(database,damaged),/Foto inválida/);
 assert.deepEqual(await readCollection(database,key),before);
});
test("importar livro novamente não duplica nem substitui conteúdo já guardado",async()=>{
 const data=genericTestBook();const same=await importBook(database,data.book,data.assets);assert.deepEqual(same,{book:0,assets:0});
 const changed=structuredClone(data.book);changed.catalog.heartIntro.title="Outro conteúdo";
 await assert.rejects(()=>importBook(database,changed,data.assets),/não sobrescreve/);
 assert.deepEqual(await readBook(database),data.book);
});
