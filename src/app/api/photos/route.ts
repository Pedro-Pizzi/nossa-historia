import { getDatabase } from "@/lib/database/server";
import { listPhotos,savePhoto,MAX_PHOTO_BYTES } from "@/lib/database/media";
import { requireAccount,dataFailure,limitedBody } from "@/lib/database/http";
import { privateHeaders } from "@/lib/auth/request";
import { DataError } from "@/lib/database/collections-model";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(){try{await requireAccount();return Response.json(await listPhotos(await getDatabase()),{headers:privateHeaders});}catch(error){return dataFailure(error);}}
export async function POST(request:Request){try{
  const actor=await requireAccount(request);const contentType=request.headers.get("content-type")||"";
  if(!contentType.startsWith("multipart/form-data;"))throw new DataError(415,"Escolha uma foto para enviar.");
  const body=await limitedBody(request,MAX_PHOTO_BYTES+16384);
  const form=await new Response(new Uint8Array(body),{headers:{"Content-Type":contentType}}).formData();
  const file=form.get("photo");if(!(file instanceof File))throw new DataError(400,"Escolha uma foto.");
  const result=await savePhoto(await getDatabase(),actor.id,Buffer.from(await file.arrayBuffer()),String(form.get("caption")||""),String(form.get("date")||""),typeof form.get("importKey")==="string"?String(form.get("importKey")):undefined);
  return Response.json(result,{status:201,headers:privateHeaders});
}catch(error){return dataFailure(error);}}
