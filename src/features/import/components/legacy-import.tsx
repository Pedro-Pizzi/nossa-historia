"use client";
import { useEffect,useState } from "react";
import { useCurrentUser } from "@/features/auth/components/user-session";
import { photoRepository as oldPhotos } from "@/lib/storage/photo-repository";
import { photoRepository } from "@/lib/storage/server-photos";
const prefix=/^(nossa-historia-|nh-v3-)/;
export function LegacyImport(){
 const user=useCurrentUser();const[available,setAvailable]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{try{setAvailable(Object.keys(localStorage).filter((key)=>prefix.test(key)&&!key.startsWith("nossa-historia-rascunho-")).length);}catch{/* a importação por arquivo continua disponível */}},[]);
 function localRecords(){const result:Record<string,unknown>={};for(const key of Object.keys(localStorage))if(prefix.test(key)&&!key.startsWith("nossa-historia-rascunho-")){const raw=localStorage.getItem(key);if(raw!==null){try{result[key]=JSON.parse(raw);}catch{result[key]=raw;}}}return result;}
 async function run(records:Record<string,unknown>,includePhotos:boolean){
  setBusy(true);let added=0,duplicates=0,skipped=0,archived=0;const failures:string[]=[];
  try{
   for(const[key,value]of Object.entries(records)){if(!prefix.test(key))continue;const response=await fetch("/api/import",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,value})});const result=await response.json();if(!response.ok){failures.push(key);continue;}added+=result.added;duplicates+=result.duplicates;skipped+=result.skipped;archived+=result.archived;}
   if(includePhotos){try{for(const photo of await oldPhotos.list()){try{const result=await photoRepository.add({blob:photo.blob,caption:photo.caption||"",date:photo.date||"",importKey:"legacy-photo"});if(result.added)added++;else duplicates++;}catch{skipped++;}}}catch{failures.push("fotos locais");}}
   setMessage(`${added} registro(s) guardado(s), ${duplicates} repetido(s), ${skipped} de outra autoria ou incompatível(is), ${archived} arquivo(s) preservado(s).${failures.length?" Alguns conjuntos não puderam ser importados. Você pode tentar novamente sem duplicar os já importados.":""} Os dados de origem não foram apagados.`);
  }catch{setMessage("Não foi possível concluir. Os dados de origem continuam preservados; você pode tentar novamente.");}
  finally{setBusy(false);window.dispatchEvent(new Event("focus"));}
 }
 function exportLocal(){const url=URL.createObjectURL(new Blob([JSON.stringify({type:"nossa-historia-backup-local",version:1,storage:localRecords()},null,2)],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download="nossa-historia-registros-locais.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
 return <details className="legacy-import"><summary>Trazer memórias antigas</summary><p>Encontramos {available} conjunto(s) de registros neste navegador. As páginas de {user.name} e os espaços sem autoria podem ser trazidos para o banco. A outra pessoa pode entrar na própria conta para trazer as páginas dela.</p><p>A importação não apaga a origem e pode ser repetida. Fotos de até 3 MB são incluídas ao importar deste aparelho.</p><div className="legacy-import-actions"><button type="button" disabled={busy} onClick={()=>{try{void run(localRecords(),true);}catch{setMessage("Não foi possível ler os registros deste navegador.");}}}>{busy?"Importando…":"Importar deste aparelho"}</button><button type="button" disabled={busy} onClick={exportLocal}>Guardar cópia dos textos locais</button><label>Importar arquivo de textos<input type="file" accept="application/json,.json" disabled={busy} onChange={async(event)=>{const file=event.currentTarget.files?.[0];event.currentTarget.value="";if(!file)return;try{if(file.size>2*1024*1024)throw new Error();const data=JSON.parse(await file.text());if(data.type!=="nossa-historia-backup-local"||!data.storage||typeof data.storage!=="object"||Array.isArray(data.storage))throw new Error();await run(data.storage,false);}catch{setMessage("Escolha um arquivo de textos exportado por este aplicativo, com até 2 MB.");}}}/></label></div><p role="status" aria-live="polite">{message}</p></details>;
}
