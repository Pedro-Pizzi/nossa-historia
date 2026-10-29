import { mkdir,writeFile,readFile,stat } from "node:fs/promises";
import { gzip,gunzip } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";
import { loadDatabaseEnvironment } from "./database-environment";
import { createDatabase } from "../src/lib/database/client";
import { exportBackup,restoreBackup } from "../src/lib/database/backup";
async function main(){
 const db=await createDatabase(loadDatabaseEnvironment());
 try{
  if(process.argv.includes("--restore")){
   const name=process.argv[process.argv.indexOf("--restore")+1];if(!name)throw new Error("Informe o arquivo .json.gz.");const file=path.resolve(name);if((await stat(file)).size>128*1024*1024)throw new Error("Backup grande demais.");
   const raw=await promisify(gunzip)(await readFile(file),{maxOutputLength:128*1024*1024});console.log("Restauração por mesclagem:",await restoreBackup(db,JSON.parse(raw.toString("utf8"))));
  }else{
   const file=path.resolve("backups",`nossa-historia-${new Date().toISOString().replace(/[:.]/g,"-")}.json.gz`);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,await promisify(gzip)(JSON.stringify(await exportBackup(db))),{flag:"wx",mode:0o600});console.log("Backup privado criado em:",file);
  }
 }finally{await db.close();}
}
main().catch(()=>{console.error("Não foi possível concluir o backup ou a restauração. Confira a conexão e o arquivo. Nenhum registro existente é sobrescrito pela restauração.");process.exitCode=1;});
