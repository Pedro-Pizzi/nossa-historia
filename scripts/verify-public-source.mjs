import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
if(!files.length)throw Error('Nenhum arquivo preparado para publicação.');
const forbidden=/^(?:Nossa Historia$|\.env(?!\.example$)|(?:artifacts|backups|\.data|\.next|node_modules)\/|content\/(?:private|story)\/|content\/legacy\/(?!styles\/)|src\/features\/[^/]+\/components\/[^/]+-chapter\.tsx$|docs\/railway-preparacao\.json$)/;
for(const file of files)if(forbidden.test(file)||/\.(?:jpe?g|png|mp[34]|wav|ogg|heic|heif|avif)$/i.test(file))throw Error(`Arquivo privado preparado para publicação: ${file}`);
const personal=new Set();
function walk(value){if(typeof value==='string'&&value.length>=40&&!value.startsWith('/acervo/'))personal.add(value);else if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')Object.values(value).forEach(walk);}
try{walk(JSON.parse(await readFile('content/private/book.json','utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
for(const file of files){
 const text=await readFile(file,'utf8');for(const value of personal)if(text.includes(value))throw Error(`Trecho do livro privado encontrado em: ${file}`);
 if(/\.(?:[cm]?[jt]sx?|json)$/.test(file)){
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const visit=node=>{if(ts.isStringLiteral(node)&&node.text.length>=40)for(const value of personal)if(value.includes(node.text))throw Error(`Fragmento do livro privado encontrado em: ${file}`);ts.forEachChild(node,visit);};visit(source);
 }
}
console.log(`Publicação conferida: ${files.length} arquivos do sistema; conteúdo pessoal fora do Git.`);
