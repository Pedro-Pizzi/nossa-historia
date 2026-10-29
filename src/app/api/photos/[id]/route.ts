import { getDatabase } from "@/lib/database/server";
import { requireAccount,dataFailure } from "@/lib/database/http";
import { DataError } from "@/lib/database/collections-model";
import { privateHeaders } from "@/lib/auth/request";
import { z } from "zod";
export const runtime="nodejs";export const dynamic="force-dynamic";type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,context:Context){try{await requireAccount();const id=z.uuid().parse((await context.params).id);const{rows}=await(await getDatabase()).query<{bytes:Uint8Array;mime:string}>("SELECT bytes,mime FROM nh_media WHERE id=$1",[id]);if(!rows[0])throw new DataError(404,"Foto não encontrada.");return new Response(new Uint8Array(rows[0].bytes),{headers:{...privateHeaders,"Content-Type":rows[0].mime,"Content-Disposition":"inline"}});}catch(error){return dataFailure(error);}}
export async function DELETE(request:Request,context:Context){try{const actor=await requireAccount(request);const id=z.uuid().parse((await context.params).id);const{rows}=await(await getDatabase()).query("DELETE FROM nh_media WHERE id=$1 AND author_id=$2 RETURNING id",[id,actor.id]);if(!rows.length)throw new DataError(403,"Você só pode apagar as fotos que enviou.");return new Response(null,{status:204,headers:privateHeaders});}catch(error){return dataFailure(error);}}
