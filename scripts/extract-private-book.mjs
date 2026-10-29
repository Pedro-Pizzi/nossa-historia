// Conversão local de conteúdo estático para dados; nunca publica arquivos.
import ts from 'typescript';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const migration=JSON.parse(await readFile('content/story/migration.json','utf8'));
const chapters={}; const tags=new Set(), attributes=new Set();
function literal(node){
 if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(prop=>{if(!ts.isPropertyAssignment(prop))throw Error('Objeto não estático');return [prop.name.text,literal(prop.initializer)];}));
 if(ts.isStringLiteral(node)||ts.isNumericLiteral(node))return ts.isStringLiteral(node)?node.text:Number(node.text);
 if(node.kind===ts.SyntaxKind.TrueKeyword)return true;
 if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
 if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.MinusToken&&ts.isNumericLiteral(node.operand))return -Number(node.operand.text);
 throw Error('Expressão não estática: '+ts.SyntaxKind[node.kind]);
}
function convert(node,source){
 if(ts.isParenthesizedExpression(node))return convert(node.expression,source);
 if(ts.isJsxText(node)){if(!node.text.trim())return null;throw Error('Texto JSX inesperado');}
 if(ts.isJsxExpression(node)){if(!node.expression)return null;if(ts.isIdentifier(node.expression)&&node.expression.text==='children')return {slot:true};return literal(node.expression);}
 if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)){
  const opening=ts.isJsxElement(node)?node.openingElement:node;const tag=opening.tagName.getText(source);tags.add(tag);const props={};
  for(const attr of opening.attributes.properties){if(!ts.isJsxAttribute(attr))throw Error('Spread inesperado');const name=attr.name.getText(source);attributes.add(name);props[name]=!attr.initializer?true:ts.isStringLiteral(attr.initializer)?attr.initializer.text:literal(attr.initializer.expression);}
  return {tag,props,children:ts.isJsxElement(node)?node.children.map(child=>convert(child,source)).filter(child=>child!==null):[]};
 }
 throw Error('Nó JSX não permitido: '+ts.SyntaxKind[node.kind]);
}
for(const chapter of migration.chapterFiles){
 const text=await readFile(chapter.file,'utf8');const source=ts.createSourceFile(chapter.file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
 const visit=node=>{if(ts.isReturnStatement(node)&&node.expression)expression=node.expression;ts.forEachChild(node,visit);};visit(source);if(!expression)throw Error('Capítulo sem retorno');chapters[chapter.id]=convert(expression,source);
}
const catalog=JSON.parse(await readFile('content/story/catalog.json','utf8'));
await mkdir('content/private',{recursive:true});
await writeFile('content/private/book.json',JSON.stringify({version:1,chapters,catalog}),{flag:'wx',mode:0o600});
console.log(JSON.stringify({chapters:Object.keys(chapters).length,tags:[...tags].sort(),attributes:[...attributes].sort()}));
