import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startAuthTestServer } from "./auth-test-server";
async function main(){
 const server=await startAuthTestServer();const base=server.origin;let ana="",pedro="";
 const get=(path:string,cookie?:string)=>fetch(base+path,{headers:cookie?{cookie}:{},redirect:"manual"});
 const json=(path:string,method:string,body:unknown,cookie?:string)=>fetch(base+path,{method,headers:{origin:base,"Content-Type":"application/json",...(cookie?{cookie}:{})},body:JSON.stringify(body)});
 const collection="nossa-historia-tres-diarios-v1",url="/api/collections/"+collection;
 try{
  for(const path of[url,"/api/photos","/api/photos/"+randomUUID()])assert.equal((await get(path)).status,401);
  assert.equal((await json("/api/import","POST",{key:collection,value:{} })).status,401);
  async function login(user:"ana"|"pedro"){const response=await json("/api/auth/login","POST",{username:user,password:server.passwords[user]});assert.equal(response.status,200);return response.headers.get("set-cookie")!.split(";")[0];}
  ana=await login("ana");pedro=await login("pedro");
  const initial=await(await get(url,ana)).json();
  let response=await json(url,"PUT",{revision:initial.revision,value:{"Ana|day":[{text:"Registro persistente da Ana",date:"2026-10-25"}]}},ana);assert.equal(response.status,200);let state=await response.json();
  assert.equal((await json(url,"PUT",{revision:state.revision,value:{...state.value,"Pedro|day":[{text:"Autoria indevida",date:"2026-10-25"}]}},ana)).status,403);
  assert.equal((await json(url,"PUT",{revision:state.revision,value:{}},pedro)).status,403);
  assert.equal((await json(url,"PUT",{revision:initial.revision,value:{}},ana)).status,409);
  response=await json(url,"PUT",{revision:state.revision,value:{...state.value,"Pedro|day":[{text:"Registro do Pedro",date:"2026-10-25"}]}},pedro);assert.equal(response.status,200);state=await response.json();
  assert.equal(state.value["Ana|day"][0].writer,"Ana");assert.equal(state.value["Pedro|day"][0].writer,"Pedro");
  const answers="/api/collections/nossa-historia-descobertas-v1";
  assert.equal((await json(answers,"PUT",{revision:0,value:{d1:[{author:"Pedro",text:"Falsa autoria",date:"2026-10-25"}]}},ana)).status,403);
  for(const[key,value]of Object.entries({"nossa-historia-cartinhas-v1":[{from:"Ana",to:"Pedro",title:"Carta",body:"Um abraço",date:"2026-10-25"}],"nossa-historia-convites-v1":[{text:"Passeio",date:"2026-10-25"}],"nh-v3-choice":[{id:randomUUID(),author:"Ana",text:"Carinho",date:"2026-10-25"}],"nh-v3-milestone":[{id:randomUUID(),author:"Ana",kind:"Uma conquista",title:"Nosso lar",text:"Uma memória",date:"2026-10-25"}],"nh-v3-checkin":[{id:randomUUID(),author:"Ana",good:"Estamos bem",better:"Conversar",date:"2026-10-25"}]})){
   const path="/api/collections/"+key;const before=await(await get(path,ana)).json();assert.equal((await json(path,"PUT",{revision:before.revision,value},ana)).status,200,key);
  }
  const imported={key:collection,value:{"Ana|dreams":[{text:"Sonho antigo",date:"2025-10-25"}],"Pedro|dreams":[{text:"Somente Pedro pode importar",date:"2025-10-25"}]}};
  let importedResponse=await json("/api/import","POST",imported,ana);assert.equal(importedResponse.status,200);assert.equal((await importedResponse.json()).added,1);
  importedResponse=await json("/api/import","POST",imported,ana);const repeated=await importedResponse.json();assert.equal(repeated.added,0);assert.equal(repeated.duplicates,1);assert.equal(repeated.skipped,1);
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC2kAAAAASUVORK5CYII=","base64");
  const form=new FormData();form.set("photo",new Blob([png],{type:"image/png"}),"teste.png");form.set("caption","Foto privada");form.set("date","2026-10-25");form.set("author","Pedro");
  const uploaded=await fetch(base+"/api/photos",{method:"POST",headers:{origin:base,cookie:ana},body:form});assert.equal(uploaded.status,201);const photo=await uploaded.json();
  const list=await(await get("/api/photos",pedro)).json();assert.equal(list[0].author,"Ana");
  assert.equal((await get("/api/photos/"+photo.id)).status,401);const content=await get("/api/photos/"+photo.id,pedro);assert.equal(content.status,200);assert.ok(Buffer.from(await content.arrayBuffer()).equals(png));
  assert.equal((await fetch(base+"/api/photos/"+photo.id,{method:"DELETE",headers:{origin:base,cookie:pedro}})).status,403);
  console.log("APIs: gravação, leitura compartilhada, autoria, conflitos, importação repetida e fotos privadas passaram.");
  await server.restart();
  assert.equal((await get("/api/auth/session",ana)).status,200,"A sessão deve sobreviver ao reinício do servidor.");
  const reopened=await(await get(url,pedro)).json();assert.equal(reopened.value["Ana|day"][0].text,"Registro persistente da Ana");assert.equal((await get("/api/photos/"+photo.id,pedro)).status,200);
  assert.equal((await fetch(base+"/api/photos/"+photo.id,{method:"DELETE",headers:{origin:base,cookie:ana}})).status,204);
  console.log("Persistência: sessões, registros e fotos sobreviveram ao reinício real do processo Next.js.");
 }finally{await server.stop();}
}
main().catch((error:unknown)=>{console.error(error instanceof Error?error.message:"Falha na verificação do banco.");process.exitCode=1;});
