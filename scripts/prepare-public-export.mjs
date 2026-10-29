import { execFileSync } from 'node:child_process';
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

execFileSync(process.execPath,['scripts/verify-public-source.mjs'],{stdio:'inherit'});
const destination=path.resolve('artifacts/github-public');
const refresh=process.argv.includes('--refresh');
await mkdir(destination,{recursive:refresh});
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const output=[];
for(const file of files){
 const target=path.resolve(destination,file),relative=path.relative(destination,target);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Caminho inválido.');
 await mkdir(path.dirname(target),{recursive:true});await copyFile(file,target,refresh?0:constants.COPYFILE_EXCL);
 const bytes=await readFile(file);output.push({path:file,base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile('artifacts/source-import.json',JSON.stringify({version:1,files:output}),{flag:refresh?'w':'wx'});
console.log(`Cópia pública preparada: ${files.length} arquivos, sem dados pessoais.`);
