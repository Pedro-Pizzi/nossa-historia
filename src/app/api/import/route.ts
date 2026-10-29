import { z } from "zod";
import { requireAccount,jsonBody,dataFailure } from "@/lib/database/http";
import { importLegacy } from "@/lib/database/import-legacy";
import { getDatabase } from "@/lib/database/server";
import { privateHeaders } from "@/lib/auth/request";
export const runtime="nodejs";
export async function POST(request:Request){try{const actor=await requireAccount(request);const body=z.object({key:z.string().max(150),value:z.unknown()}).parse(await jsonBody(request));return Response.json(await importLegacy(await getDatabase(),actor.id,body.key,body.value),{headers:privateHeaders});}catch(error){return dataFailure(error);}}
