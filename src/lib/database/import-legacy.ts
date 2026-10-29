import { createHash,randomUUID } from "node:crypto";
import type { Database } from "./client";
import type { AccountId } from "../auth/config";
import { candidates,canWriteGroup,collectionKinds,fingerprint,isCollectionKey,parseFlags,personName,DataError } from "./collections-model";

export async function importLegacy(db:Database,actor:AccountId,key:string,value:unknown){
  return db.transaction(async(tx)=>{
    let added=0,duplicates=0,skipped=0,archived=0;
    if(!isCollectionKey(key)){
      if(!/^(nossa-historia-|nh-v3-)/.test(key)||key.length>150)throw new DataError(400,"Arquivo de origem não reconhecido.");
      const raw=JSON.stringify(value);const digest=createHash("sha256").update(raw).digest("hex");
      const result=await tx.query("INSERT INTO nh_legacy_archive(id,author_id,key,value,fingerprint) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT(author_id,key,fingerprint) DO NOTHING RETURNING id",[randomUUID(),actor,key,raw,digest]);
      return{added:0,duplicates:result.rows.length?0:1,skipped:0,archived:result.rows.length};
    }
    await tx.query("SELECT key FROM nh_collections WHERE key=$1 FOR UPDATE",[key]);
    if(collectionKinds[key]==="flags"){
      for(const[id,done]of Object.entries(parseFlags(value))){const result=await tx.query("INSERT INTO nh_flags(key,done,updated_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key",[id,done,actor]);if(result.rows.length)added++;else duplicates++;}
    }else{
      const grouped=collectionKinds[key]==="book"||collectionKinds[key]==="answers";
      if(!value||typeof value!=="object"||(!grouped&&!Array.isArray(value)))throw new DataError(400,"Os registros antigos não estão no formato esperado.");
      const groups=grouped?Object.entries(value as Record<string,unknown>):[["",value]];
      for(const[group,entries]of groups){
        if(!Array.isArray(entries)){skipped++;continue;}
        for(const raw of entries){
          let entry;try{entry=candidates(key,grouped?{[group as string]:[raw]}:[raw])[0];}catch{skipped++;continue;}
          if(!canWriteGroup(actor,key,entry.group)||(entry.declaredAuthor&&entry.declaredAuthor!==personName(actor)&&entry.declaredAuthor!=="Nós")){skipped++;continue;}
          if(entry.declaredAuthor==="Nós"&&!["milestone","checkin"].includes(collectionKinds[key])){skipped++;continue;}
          const digest=fingerprint(entry.group,entry.data);
          const existing=await tx.query("SELECT id FROM nh_entries WHERE collection=$1 AND fingerprint=$2 AND (author_id=$3 OR $4::boolean) LIMIT 1",[key,digest,actor,!entry.declaredAuthor||entry.declaredAuthor==="Nós"]);
          if(existing.rows.length){duplicates++;continue;}
          await tx.query("INSERT INTO nh_entries(id,collection,group_key,author_id,data,fingerprint,original_author) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)",[randomUUID(),key,entry.group,actor,JSON.stringify(entry.data),digest,entry.declaredAuthor==="Nós"?"Nós":null]);added++;
        }
      }
    }
    if(added)await tx.query("UPDATE nh_collections SET revision=revision+1 WHERE key=$1",[key]);
    return{added,duplicates,skipped,archived};
  });
}
