import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID,createHash } from "node:crypto";
import path from "node:path";
import { createDatabase } from "../src/lib/database/client";
import { loadDatabaseEnvironment } from "./database-environment";
import { verifyStoryHtml } from "./verify-story.mjs";

let stage="carregar configuração privada";
async function main(){
 const env=loadDatabaseEnvironment();
 const access=JSON.parse(await readFile(path.join(process.env.LOCALAPPDATA!,"NossaHistoria/private/acessos.json"),"utf8")) as{site:string;usuarios:{ana:string;pedro:string}};
 const base=new URL(access.site).origin;assert.equal(new URL(base).protocol,"https:");
 stage="verificar TLS e rejeição de certificado diferente";
 const db=await createDatabase({...env,NODE_ENV:"production"});
 try{const result=await db.query<{count:string}>("SELECT count(*)::text AS count FROM nh_book_assets");assert.equal(Number(result.rows[0].count),42);}finally{await db.close();}
 const bad=await createDatabase({...env,NODE_ENV:"production",DATABASE_SSL_CERT:env.DATABASE_SSL_CA});
 try{await assert.rejects(()=>bad.query("SELECT 1"),/certificado do banco não corresponde/);}finally{await bad.close();}
 const manifest=JSON.parse(await readFile("content/legacy/manifest.json","utf8"));
 const sample=manifest.media[0] as{file:string;sha256:string};
 const get=(file:string,cookie?:string)=>fetch(base+file,{redirect:"manual",headers:cookie?{cookie}:{}});
 const send=(file:string,method:string,body:unknown,cookie?:string)=>fetch(base+file,{method,redirect:"manual",headers:{origin:base,"content-type":"application/json",...(cookie?{cookie}:{})},body:JSON.stringify(body)});
 stage="conferir bloqueios sem login";
 assert.equal((await get("/")).status,307);assert.equal((await get("/api/photos")).status,401);assert.equal((await get("/acervo/"+sample.file)).status,401);
 const cookies:string[]=[];let temporaryId="";
 const endpoint="/api/collections/nossa-historia-tres-diarios-v1";
 async function removeTemporary(){
  if(!temporaryId)return;
  for(let attempt=0;attempt<3;attempt++){
   const latest=await(await get(endpoint,cookies[0])).json();
   const value={...latest.value,"Ana|day":(latest.value["Ana|day"]||[]).filter((entry:{id:string})=>entry.id!==temporaryId)};
   const response=await send(endpoint,"PUT",{revision:latest.revision,value},cookies[0]);
   if(response.status===409)continue;assert.equal(response.status,200);temporaryId="";return;
  }
  throw Error("Edição simultânea durante a limpeza da verificação.");
 }
 try{
  stage="entrar nas duas contas";
  for(const username of ["ana","pedro"] as const){const response=await send("/api/auth/login","POST",{username,password:access.usuarios[username]});assert.equal(response.status,200);const header=response.headers.get("set-cookie")!;assert.ok(header.includes("HttpOnly")&&header.includes("Secure"));cookies.push(header.split(";")[0]);}
  stage="conferir livro e imagens privados";
  const root=await get("/",cookies[0]);assert.equal(root.status,200);console.log("Livro em produção:",await verifyStoryHtml(await root.text()));
  for(let number=1;number<=9;number++)assert.equal((await get(`/acervo/styles/style-0${number}.css`,cookies[0])).status,200);
  const photo=await get("/acervo/"+sample.file,cookies[0]);assert.equal(photo.status,200);assert.ok(photo.headers.get("cache-control")?.includes("no-store"));assert.equal(createHash("sha256").update(Buffer.from(await photo.arrayBuffer())).digest("hex"),sample.sha256);
  assert.equal((await get("/acervo/document.html",cookies[0])).status,404);
  stage="verificar gravação compartilhada e autoria";
  const current=await(await get(endpoint,cookies[0])).json();const text=`Verificação temporária de implantação ${randomUUID()}`;
  const value={...current.value,"Ana|day":[...(current.value["Ana|day"]||[]),{text,date:new Date().toISOString().slice(0,10)}]};
  const written=await send(endpoint,"PUT",{revision:current.revision,value},cookies[0]);assert.equal(written.status,200);const state=await written.json();temporaryId=state.value["Ana|day"].find((entry:{text:string})=>entry.text===text).id;
  const shared=await(await get(endpoint,cookies[1])).json();assert.ok(shared.value["Ana|day"].some((entry:{id:string})=>entry.id===temporaryId));
  const forbidden={...shared.value,"Ana|day":shared.value["Ana|day"].filter((entry:{id:string})=>entry.id!==temporaryId)};
  assert.equal((await send(endpoint,"PUT",{revision:shared.revision,value:forbidden},cookies[1])).status,403);
  await removeTemporary();
  console.log("Produção: TLS verificado, pin diferente recusado, duas contas, escrita, leitura compartilhada, autoria, mídia privada e estilos conferidos. Registro temporário removido.");
 }finally{
  await removeTemporary();
  for(const cookie of cookies){await send("/api/auth/logout","POST",{},cookie);assert.equal((await get("/api/auth/session",cookie)).status,401);}
 }
}
main().catch(()=>{console.error(`Verificação de produção falhou na etapa: ${stage}. Nenhuma credencial foi exibida.`);process.exitCode=1;});
