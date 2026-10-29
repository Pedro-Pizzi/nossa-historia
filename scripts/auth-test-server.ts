import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { hashPassword } from "../src/lib/auth/password";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createDatabase } from "../src/lib/database/client";
import { migrate } from "../src/lib/database/migrate";
import { importBook } from "../src/lib/database/book";
import { testBook } from "./test-book";

/** Credenciais descartáveis, mantidas em memória. Nunca altera o .env.local. */
export async function startAuthTestServer({ production = true, configured = true, port = 3101,testPasswords }:{production?:boolean;configured?:boolean;port?:number;testPasswords?:{ana:string;pedro:string}} = {}) {
  const origin = `http://127.0.0.1:${port}`;
  const passwords = testPasswords || { ana: randomBytes(20).toString("hex"), pedro: randomBytes(20).toString("hex") };
  const directory=configured?await mkdtemp(path.join(tmpdir(),"nh-db-fixture-")):undefined;
  const env = { ...process.env, DATABASE_MODE:configured?"pglite":"",DATABASE_PATH:directory||"",DATABASE_URL:"", NODE_ENV: production ? "production" : "development", AUTH_ORIGIN: origin, AUTH_SESSION_SECRET: configured ? randomBytes(48).toString("hex") : "", AUTH_ANA_PASSWORD_HASH: configured ? await hashPassword(passwords.ana) : "", AUTH_PEDRO_PASSWORD_HASH: configured ? await hashPassword(passwords.pedro) : "" };
  if(configured){const db=await createDatabase(env);try{await migrate(db);const content=await testBook();await importBook(db,content.book,content.assets);}finally{await db.close();}}
  const launch=()=>spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), production ? "start" : "dev", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let child = launch();
  let output = "";
  let exited = false;
  function observe(){child.stdout.on("data", (chunk) => { output = (output + chunk).slice(-12000); });child.stderr.on("data", (chunk) => { output = (output + chunk).slice(-12000); });child.on("exit",()=>{exited=true;});}observe();
  async function stopProcess(){if(!exited){const done=new Promise<void>((resolve)=>child.once("exit",()=>resolve()));child.kill();await done;}}
  async function stop() {
    await stopProcess();
    if(directory){const relative=path.relative(tmpdir(),directory);if(relative.startsWith("..")||path.isAbsolute(relative)||!path.basename(directory).startsWith("nh-db-fixture-"))throw new Error("Diretório de teste inesperado.");await rm(directory,{recursive:true,force:true});}
  }
  async function waitReady(){
    const deadline = Date.now() + 30000;
    let ready = false;
    while (Date.now() < deadline) {
      if (exited) throw new Error("Servidor de verificação não iniciou. Confira a compilação e a porta escolhida.");
      try { const response = await fetch(origin + "/login", { signal: AbortSignal.timeout(1500) }); if (response.status === 200) { ready = true; break; } } catch { /* aguardando o servidor */ }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error("O servidor de verificação não respondeu a tempo.");
  }
  try{await waitReady();return { origin,passwords,production,output:()=>output,stop,async restart(){await stopProcess();exited=false;child=launch();observe();await waitReady();}};}catch(error){await stop();throw error;}
}
