import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
export function loadDatabaseEnvironment(){const nextRequire=createRequire(require.resolve("next/package.json"));const loader=nextRequire("@next/env") as{loadEnvConfig:(dir:string,dev:boolean)=>unknown};loader.loadEnvConfig(process.cwd(),true);return process.env;}
