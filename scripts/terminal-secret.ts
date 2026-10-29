import { stdin,stdout } from "node:process";
import { emitKeypressEvents,type Key } from "node:readline";
export function readSecret(prompt:string,maxLength=4096):Promise<string>{
 if(!stdin.isTTY||!stdout.isTTY)throw new Error("Execute este configurador em um terminal interativo.");
 emitKeypressEvents(stdin);stdin.setRawMode(true);stdin.resume();stdout.write(prompt);
 return new Promise((resolve,reject)=>{let value="";function finish(error?:Error){stdin.off("keypress",keypress);stdin.setRawMode(false);stdin.pause();stdout.write("\n");if(error)reject(error);else resolve(value);}
 function keypress(text:string|undefined,key:Key){if(key.ctrl&&key.name==="c"){finish(new Error("Configuração cancelada."));return;}if(key.name==="return"||key.name==="enter"){finish();return;}if(key.name==="backspace"){if(value){value=[...value].slice(0,-1).join("");stdout.write("\b \b");}return;}if(!key.ctrl&&!key.meta&&text&&!/[\r\n\x00-\x1f\x7f]/.test(text)&&value.length+text.length<=maxLength){value+=text;stdout.write("*".repeat([...text].length));}}
 stdin.on("keypress",keypress);});
}
