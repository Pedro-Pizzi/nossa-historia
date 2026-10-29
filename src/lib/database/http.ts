import { z } from "zod";
import { currentAccount, getAuthConfig } from "../auth/server";
import { privateHeaders, trustedOrigin } from "../auth/request";
import { DataError } from "./collections-model";

export async function requireAccount(request?: Request) {
  const account = await currentAccount();
  if (!account) throw new DataError(401,"Entre na sua conta para continuar.");
  if (request && !trustedOrigin(request,getAuthConfig()!.origin)) throw new DataError(403,"A origem da solicitação não foi reconhecida.");
  return account;
}
export async function limitedBody(request: Request, max: number) {
  if (!request.body) throw new DataError(400,"Solicitação vazia.");
  const reader=request.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
  try { for(;;) { const part=await reader.read(); if(part.done)break; size+=part.value.byteLength; if(size>max){await reader.cancel();throw new DataError(413,"O arquivo ou conjunto de registros é grande demais.");} chunks.push(part.value); } return Buffer.concat(chunks); }
  finally { reader.releaseLock(); }
}
export async function jsonBody(request: Request,max=2*1024*1024):Promise<unknown> {
  if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json") throw new DataError(415,"Envie os registros no formato JSON.");
  try { return JSON.parse((await limitedBody(request,max)).toString("utf8")); } catch(error) { if(error instanceof DataError)throw error; throw new DataError(400,"O arquivo não contém JSON válido."); }
}
export function dataFailure(error: unknown) {
  if(error instanceof DataError) return Response.json({message:error.message},{status:error.status,headers:privateHeaders});
  if(error instanceof z.ZodError) return Response.json({message:"Confira os campos do registro antes de guardar."},{status:400,headers:privateHeaders});
  return Response.json({message:"Não foi possível acessar o banco agora. Seu texto continua na página."},{status:503,headers:privateHeaders});
}
