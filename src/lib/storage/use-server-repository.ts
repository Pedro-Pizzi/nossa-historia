"use client";
import { useEffect,useRef,useState } from "react";

const EVENT="nossa-historia:server-records";
export function useServerRepository<T>(key:string,initial:T,validate:(value:unknown)=>value is T){
  const [value,setValue]=useState(initial),[ready,setReady]=useState(false),[error,setError]=useState(""),[pending,setPending]=useState(false);
  const snapshot=useRef({value:initial,revision:0}),busy=useRef(false),sequence=useRef(0);
  const refreshRef=useRef<()=>Promise<void>>(async()=>{});
  useEffect(()=>{
    let active=true;
    async function refresh(){
      if(busy.current)return;
      const request=++sequence.current;
      try{const response=await fetch(`/api/collections/${encodeURIComponent(key)}`,{cache:"no-store",credentials:"same-origin"});if(!response.ok)throw new Error(response.status===401?"Entre na sua conta para continuar.":"Não foi possível carregar os registros do banco.");const data=await response.json();if(!validate(data.value)||!Number.isInteger(data.revision))throw new Error("O banco retornou registros em um formato inesperado.");if(!active||request!==sequence.current)return;snapshot.current=data;setValue(data.value);setError("");setReady(true);}catch(cause){if(active)setError(cause instanceof Error?cause.message:"Não foi possível acessar o banco.");}
    }
    refreshRef.current=refresh;void refresh();
    const changed=(event:Event)=>{if((event as CustomEvent<string>).detail===key)void refresh();};
    const focus=()=>{void refresh();};
    const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel("nossa-historia-records"):null;
    if(channel)channel.onmessage=(event)=>{if(event.data===key)void refresh();};
    window.addEventListener(EVENT,changed);window.addEventListener("focus",focus);const timer=setInterval(focus,15000);
    return()=>{active=false;sequence.current++;clearInterval(timer);channel?.close();window.removeEventListener(EVENT,changed);window.removeEventListener("focus",focus);};
  },[key,validate]);
  async function update(updater:(current:T)=>T):Promise<boolean>{
    if(!ready||busy.current)return false;
    busy.current=true;sequence.current++;setPending(true);
    try{
      const next=updater(structuredClone(snapshot.current.value));
      if(!validate(next))throw new Error("Confira o formato do registro.");
      const response=await fetch(`/api/collections/${encodeURIComponent(key)}`,{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:snapshot.current.revision,value:next})});
      const result=await response.json();
      if(!response.ok){if(response.status===409){busy.current=false;await refreshRef.current();busy.current=true;}throw new Error(result.message||"Não foi possível guardar. Seu texto continua nesta página.");}
      if(!validate(result.value))throw new Error("Não foi possível confirmar o registro salvo.");
      snapshot.current=result;setValue(result.value);setError("");
      window.dispatchEvent(new CustomEvent(EVENT,{detail:key}));const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel("nossa-historia-records"):null;channel?.postMessage(key);channel?.close();
      return true;
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível guardar. Seu texto continua nesta página.");return false;}
    finally{busy.current=false;setPending(false);}
  }
  return{value,ready:ready&&!pending,error,update,pending};
}
