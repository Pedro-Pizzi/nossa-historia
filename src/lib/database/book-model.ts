import { z } from "zod";
import { createHash } from "node:crypto";

export const chapterIds=["opening","carta","memorias","diario","perguntas","sonhos","biblioteca","acolhimento","encontros","escolha","marcos","checkin","lembrar","neste-dia","final"] as const;
export const assetPath=/^assets\/[a-f0-9]{64}\.(jpg|png|webp|gif|avif|heic|heif)$/;
const assetUrl=z.string().regex(/^\/acervo\/assets\/[a-f0-9]{64}\.(jpg|png|webp|gif|avif|heic|heif)$/);
const tags=new Set(["StoryAction","StoryPhoto","a","article","blockquote","div","em","figcaption","figure","h1","h2","i","img","p","section","span","strong"]);
const attributes=new Set(["action","alt","aria-hidden","aria-label","className","decoding","href","id","loading","src","style","tabIndex","target","type"]);
type Property=string|number|boolean|Record<string,string>;
export type BookNode=string|{slot:true}|{tag:string;props:Record<string,Property>;children:BookNode[]};
const string=z.string().max(30000);
const question=z.object({id:z.string().regex(/^[dc]\d+$/),text:string,label:string,placeholder:string});
export const catalogSchema=z.object({
 questionSections:z.array(z.object({tab:string,title:string,description:string,heart:z.boolean(),questions:z.array(question).max(200)})).max(200),
 challenges:z.array(z.tuple([string,string,string])).max(100),
 bookIcons:z.object({Ana:assetUrl,Pedro:assetUrl,"Nós":assetUrl}),
 favoriteIcons:z.record(z.string().max(80),assetUrl),
 heartIntro:z.object({title:string,description:string}),
});
export type StoryCatalog=z.infer<typeof catalogSchema>;
export interface PrivateBook{version:1;chapters:Record<string,BookNode>;catalog:StoryCatalog}
function validateNode(value:unknown,depth:number,counter:{nodes:number}):BookNode{
 if(++counter.nodes>20000||depth>50)throw Error("Livro grande demais.");
 if(typeof value==="string")return string.parse(value);
 const node=z.record(z.string(),z.unknown()).parse(value);
 if(node.slot===true&&Object.keys(node).length===1)return{slot:true};
 if(typeof node.tag!=="string"||!tags.has(node.tag))throw Error("Elemento de livro não permitido.");
 if(Object.keys(node).some(key=>!["tag","props","children"].includes(key)))throw Error("Campo de livro não permitido.");
 const raw=z.record(z.string(),z.unknown()).parse(node.props);const props:Record<string,Property>={};
 for(const [key,item] of Object.entries(raw)){
  if(!attributes.has(key))throw Error("Atributo de livro não permitido.");
  if(key==="style"){props.style=z.object({marginLeft:z.literal("auto").optional(),marginRight:z.literal("auto").optional()}).strict().parse(item);continue;}
  if(typeof item!=="string"&&typeof item!=="number"&&typeof item!=="boolean")throw Error("Atributo inválido.");
  if(typeof item==="string")string.parse(item);
  if(key==="src")assetUrl.parse(item);
  if(key==="href"&&!/^#[a-z][a-z0-9-]*$/.test(String(item)))throw Error("Link de livro não permitido.");
  if(key==="target"&&(node.tag!=="StoryAction"||!chapterIds.includes(item as typeof chapterIds[number])))throw Error("Destino inválido.");
  if(key==="action"&&(node.tag!=="StoryAction"||!["go","start","restart"].includes(String(item))))throw Error("Ação inválida.");
  if(key==="type"&&item!=="button")throw Error("Tipo inválido.");
  props[key]=item;
 }
 if((node.tag==="img"||node.tag==="StoryPhoto")&&!props.src)throw Error("Imagem sem origem.");
 if(node.tag==="StoryAction"&&!props.action)throw Error("Controle sem ação.");
 if(!Array.isArray(node.children))throw Error("Conteúdo inválido.");
 return{tag:node.tag,props,children:node.children.map(child=>validateNode(child,depth+1,counter))};
}
export function parseBook(input:unknown):PrivateBook{
 const data=z.object({version:z.literal(1),chapters:z.record(z.string(),z.unknown()),catalog:catalogSchema}).strict().parse(input);
 if(Object.keys(data.chapters).length!==chapterIds.length||chapterIds.some(id=>!data.chapters[id]))throw Error("Capítulos incompletos.");
 const counter={nodes:0};const chapters:Record<string,BookNode>={};
 for(const id of chapterIds){const node=validateNode(data.chapters[id],0,counter);if(typeof node==="string"||"slot"in node||node.props.id!==id)throw Error("Identificação do capítulo inválida.");chapters[id]=node;}
 return{version:1,chapters,catalog:data.catalog};
}
function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));return value;}
export function bookHash(value:unknown){return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");}
