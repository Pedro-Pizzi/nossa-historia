import { z } from "zod";
import { getDatabase } from "@/lib/database/server";
import { readCollection,writeCollection } from "@/lib/database/collections";
import { isCollectionKey,DataError } from "@/lib/database/collections-model";
import { dataFailure,jsonBody,requireAccount } from "@/lib/database/http";
import { privateHeaders } from "@/lib/auth/request";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{key:string}>};
export async function GET(_request:Request,context:Context){try{await requireAccount();const{key}=await context.params;if(!isCollectionKey(key))throw new DataError(404,"Conjunto não encontrado.");return Response.json(await readCollection(await getDatabase(),key),{headers:privateHeaders});}catch(error){return dataFailure(error);}}
export async function PUT(request:Request,context:Context){try{const actor=await requireAccount(request);const{key}=await context.params;if(!isCollectionKey(key))throw new DataError(404,"Conjunto não encontrado.");const body=z.object({revision:z.number().int().nonnegative(),value:z.unknown()}).parse(await jsonBody(request));return Response.json(await writeCollection(await getDatabase(),actor.id,key,body.revision,body.value),{headers:privateHeaders});}catch(error){return dataFailure(error);}}
