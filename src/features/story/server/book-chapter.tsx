import "server-only";
import { createElement,Fragment,type ReactNode } from "react";
import type { BookNode } from "@/lib/database/book-model";
import { StoryAction,StoryPhoto } from "../components/story-controls";

/** A árvore já validada contém somente elementos e controles conhecidos. */
export function BookChapter({tree,children}:{tree:BookNode;children?:ReactNode}){
 function render(node:BookNode,key:string):ReactNode{
  if(typeof node==="string")return node;
  if("slot"in node)return createElement(Fragment,{key},children);
  const items=node.children.map((child,index)=>render(child,`${key}.${index}`));
  if(node.tag==="StoryAction")return createElement(StoryAction,{...node.props,key,action:node.props.action as "go"|"start"|"restart"},...items);
  if(node.tag==="StoryPhoto")return createElement(StoryPhoto,{...node.props,key,src:String(node.props.src),alt:String(node.props.alt||"")},...items);
  return createElement(node.tag,{...node.props,key},...items);
 }
 return render(tree,"chapter");
}
