import { execFileSync,spawnSync } from "node:child_process";
import { readFile,writeFile,mkdir } from "node:fs/promises";
import { randomBytes,X509Certificate } from "node:crypto";
import path from "node:path";
import { createDatabase } from "../src/lib/database/client";
import { migrate } from "../src/lib/database/migrate";
import { importBook } from "../src/lib/database/book";
import { hashPassword,validPasswordHash } from "../src/lib/auth/password";
import { privateBookFiles } from "./private-book-files";
import { loadDatabaseEnvironment } from "./database-environment";
import { mergeAuthEnvironment } from "./auth-env";

let stage="validar configuração";
async function main(){
 const originArg=process.argv[process.argv.indexOf("--origin")+1];
 const origin=new URL(originArg||"");if(origin.protocol!=="https:"||origin.origin!==originArg)throw Error("Origem HTTPS exata obrigatória.");
 if(!process.env.LOCALAPPDATA)throw Error("Execute no Windows onde os CLIs foram autenticados.");
 const home=path.join(process.env.LOCALAPPDATA,"NossaHistoria");
 const railway=path.join(home,"cli/railway.exe"),vercel=path.join(home,"vercel-cli/node_modules/vercel/dist/vc.js");
 const project=JSON.parse(await readFile(".vercel/project.json","utf8")) as{projectId:string};
 const existing=await readFile(".env.local","utf8").catch(error=>{if(error.code==="ENOENT")return "";throw error;});
 const env=loadDatabaseEnvironment();
 stage="ler conexão pelo Railway CLI";
 const cli=(args:string[])=>JSON.parse(execFileSync(railway,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
 const variables=cli(["variable","list","--service","Postgres","--environment","production","--json"]) as Record<string,string>;
 const proxyData=cli(["tcp-proxy","list","--service","Postgres","--environment","production","--json"]);
 const proxies=Array.isArray(proxyData)?proxyData:proxyData.proxies||proxyData.tcpProxies;
 const proxy=proxies?.find((item:{applicationPort:number})=>item.applicationPort===5432);
 if(!variables.DATABASE_URL||!proxy?.domain||!proxy.proxyPort)throw Error("Conexão ou proxy ausente.");
 const connection=new URL(variables.DATABASE_URL);connection.hostname=proxy.domain;connection.port=String(proxy.proxyPort);
 const cert=await readFile(path.join(home,"certs/server.crt"),"utf8");
 const ca=await readFile(path.join(home,"certs/root.crt"),"utf8");
 if(!new X509Certificate(cert).verify(new X509Certificate(ca).publicKey))throw Error("Cadeia do certificado não corresponde.");
 const databaseValues={DATABASE_MODE:"postgres",DATABASE_URL:connection.toString(),DATABASE_PATH:"",DATABASE_SSL_CA:ca,DATABASE_SSL_CERT:cert};
 stage="conectar ao PostgreSQL com TLS verificado";
 const db=await createDatabase({...env,...databaseValues,NODE_ENV:"production"});
 try{
  await db.query("SELECT 1");stage="migrar e importar o livro privado";await migrate(db);
  const book=await privateBookFiles();if(!book)throw Error("Pacote privado ausente.");
  console.log("Livro privado importado:",await importBook(db,book.book,book.assets));
 }finally{await db.close();}
 stage="configurar acessos privados";
 let auth:Record<string,string>;
 if(env.AUTH_SESSION_SECRET&&validPasswordHash(env.AUTH_ANA_PASSWORD_HASH||"")&&validPasswordHash(env.AUTH_PEDRO_PASSWORD_HASH||"")){
  auth={AUTH_SESSION_SECRET:env.AUTH_SESSION_SECRET,AUTH_ANA_PASSWORD_HASH:env.AUTH_ANA_PASSWORD_HASH!,AUTH_PEDRO_PASSWORD_HASH:env.AUTH_PEDRO_PASSWORD_HASH!};
 }else{
  if(env.AUTH_SESSION_SECRET||env.AUTH_ANA_PASSWORD_HASH||env.AUTH_PEDRO_PASSWORD_HASH)throw Error("Configuração de acesso parcial; não será substituída.");
  const passwords={ana:randomBytes(24).toString("base64url"),pedro:randomBytes(24).toString("base64url")};
  auth={AUTH_SESSION_SECRET:randomBytes(48).toString("hex"),AUTH_ANA_PASSWORD_HASH:await hashPassword(passwords.ana),AUTH_PEDRO_PASSWORD_HASH:await hashPassword(passwords.pedro)};
  const directory=path.join(home,"private");await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,"acessos.json"),JSON.stringify({site:origin.origin,usuarios:passwords},null,2)+"\n",{flag:"wx",mode:0o600});
  console.log("Senhas individuais geradas e guardadas em arquivo local privado, fora do repositório.");
 }
 await writeFile(".env.local",mergeAuthEnvironment(existing,{...databaseValues,...auth,AUTH_ORIGIN:"http://127.0.0.1:3000"}),{mode:0o600});
 const production={DATABASE_MODE:databaseValues.DATABASE_MODE,DATABASE_URL:databaseValues.DATABASE_URL,DATABASE_SSL_CA:ca,DATABASE_SSL_CERT:cert,...auth,AUTH_ORIGIN:origin.origin};
 for(const [name,value]of Object.entries(production)){
  stage=`configurar variável ${name}`;
  const child=spawnSync(process.execPath,[vercel,"env","add",name,"--environment","production","--sensitive","--yes","--force","--project",project.projectId],{input:value,encoding:"utf8",windowsHide:true,stdio:["pipe","pipe","pipe"]});
  if(child.status!==0)throw Error("O CLI recusou a variável.");console.log("Variável de produção configurada:",name);
 }
 console.log("Railway e Vercel conectados. Publique uma nova versão para aplicar as variáveis.");
}
main().catch(()=>{console.error(`Não foi possível concluir a etapa: ${stage}. As credenciais não foram exibidas.`);process.exitCode=1;});
