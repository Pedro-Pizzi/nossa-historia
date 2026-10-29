export interface StoredPhoto{id:string;author:"Ana"|"Pedro";mime:string;caption:string;date:string;created:string;url:string;}
export const PHOTO_EVENT="nossa-historia:photos";
function changed(){window.dispatchEvent(new Event(PHOTO_EVENT));const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(PHOTO_EVENT):null;channel?.postMessage("changed");channel?.close();}
export const photoRepository={
  async list():Promise<StoredPhoto[]>{const response=await fetch("/api/photos",{cache:"no-store",credentials:"same-origin"});if(!response.ok)throw new Error("Não foi possível carregar as fotos do banco.");return response.json();},
  async add(photo:{blob:Blob;caption:string;date:string;created?:string;importKey?:string}){const form=new FormData();form.set("photo",photo.blob,"memoria");form.set("caption",photo.caption);form.set("date",photo.date);if(photo.importKey)form.set("importKey",photo.importKey);const response=await fetch("/api/photos",{method:"POST",credentials:"same-origin",body:form});const result=await response.json();if(!response.ok)throw new Error(result.message||"Não foi possível guardar a foto.");changed();return result;},
  async remove(id:string){const response=await fetch(`/api/photos/${id}`,{method:"DELETE",credentials:"same-origin"});if(!response.ok){const result=await response.json();throw new Error(result.message||"Não foi possível apagar esta foto.");}changed();},
};
