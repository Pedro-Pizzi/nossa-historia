import { readFile,writeFile,mkdir } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import { stdin,stdout } from "node:process";
import { readSecret } from "./terminal-secret";
import { mergeAuthEnvironment } from "./auth-env";
import { createDatabase } from "../src/lib/database/client";
import { migrate } from "../src/lib/database/migrate";
import { privateBookFiles } from "./private-book-files";
import { importBook } from "../src/lib/database/book";

async function main(){
 const file=path.resolve(".env.local");let existing="",exists=false;
 try{existing=await readFile(file,"utf8");exists=true;}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
 if(/^\s*DATABASE_MODE\s*=/m.test(existing)&&!process.argv.includes("--replace"))throw new Error("O banco já está configurado. Use db:setup --replace apenas para trocar a conexão; os dados do banco anterior serão preservados.");
 const prompt=createInterface({input:stdin,output:stdout});let choice:string;
 try{choice=await prompt.question("Banco: [1] PostgreSQL local sem Docker (gratuito) ou [2] PostgreSQL do Railway? ");}finally{prompt.close();}
 let values:Record<string,string>;
 if(choice.trim()==="1"){
  const directory=path.join(process.env.LOCALAPPDATA||path.join(homedir(),".local","share"),"NossaHistoria","database");await mkdir(path.dirname(directory),{recursive:true});
  values={DATABASE_MODE:"pglite",DATABASE_PATH:directory,DATABASE_URL:"",DATABASE_SSL_CA:"",DATABASE_SSL_CERT:""};
 }else if(choice.trim()==="2"){
  const uri=await readSecret("URL de conexão do PostgreSQL (não será exibida): ");new URL(uri);
  const certPrompt=createInterface({input:stdin,output:stdout});let certificatePath:string;
  try{certificatePath=await certPrompt.question("Caminho do certificado próprio do servidor Railway, se necessário (Enter para certificados públicos): ");}finally{certPrompt.close();}
  values={DATABASE_MODE:"postgres",DATABASE_URL:uri,DATABASE_PATH:"",DATABASE_SSL_CA:"",DATABASE_SSL_CERT:certificatePath.trim()?await readFile(path.resolve(certificatePath.trim()),"utf8"):""};
 }else throw new Error("Escolha 1 ou 2. Nada foi alterado.");
 const database=await createDatabase({...process.env,...values});
 try{await migrate(database);const content=await privateBookFiles();if(content)await importBook(database,content.book,content.assets);}finally{await database.close();}
 await writeFile(file,mergeAuthEnvironment(existing,values),{flag:exists?"w":"wx",mode:0o600});
 console.log("Banco preparado e conexão salva em .env.local. Agora configure os acessos, se necessário, e reinicie o aplicativo.");
}
main().catch(()=>{console.error("Não foi possível preparar o banco. Confira a opção escolhida, a conexão e o certificado. As credenciais não foram exibidas.");process.exitCode=1;});
