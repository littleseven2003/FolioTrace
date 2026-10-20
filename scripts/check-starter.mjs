import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
function list(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>['.git','node_modules','dist','out'].includes(e.name)?[]:e.isDirectory()?list(path.join(dir,e.name)):[path.join(dir,e.name)])}
const files=list(root);
for(const file of files){if(file.endsWith('.json'))JSON.parse(fs.readFileSync(file,'utf8'));if(file.endsWith('.md')){const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){const link=match[1].split('#')[0];if(!link||/^(https?:|mailto:)/.test(link))continue;assert(fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(link))),`Broken link in ${path.relative(root,file)}: ${link}`)}}}
const html=read('prototype/index.html');assert(html.includes('FolioTrace'));assert(!html.includes('文序'));
for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script);
const symbols=new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map(x=>x[1]));
for(const [,id] of html.matchAll(/<use href="#([a-z-]+)"/g))assert(symbols.has(id),`Missing icon ${id}`);
const p=json('examples/demo-project/.docwork/project.json');const t=json('examples/demo-project/.docwork/tasks/task-demo-001.json');const e=json('examples/demo-project/.docwork/changes/event-demo-001.json');
assert.equal(p.projectId,t.projectId);assert.equal(e.projectId,p.projectId);assert.equal(e.taskId,t.taskId);
const allFiles=[...p.files,...e.outputs.map(o=>o.file)],allVersions=[...p.versions,...e.outputs.map(o=>o.version)];
for(const group of [allFiles,allVersions,p.documents])assert.equal(new Set(group.map(x=>x.id)).size,group.length,'Duplicate IDs');
const fileMap=new Map(allFiles.map(f=>[f.id,f])),versionMap=new Map(allVersions.map(v=>[v.id,v])),docIds=new Set(p.documents.map(d=>d.id));
const demo=path.join(root,'examples/demo-project');
for(const f of allFiles){assert(!path.isAbsolute(f.relativePath)&&!f.relativePath.split('/').includes('..'));const abs=fs.realpathSync(path.join(demo,f.relativePath));assert(abs.startsWith(demo+path.sep));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'),f.sha256,`Bad fingerprint: ${f.relativePath}`)}
for(const v of allVersions){assert(docIds.has(v.documentId));assert.equal(v.sha256,fileMap.get(v.fileId)?.sha256);if(v.parentVersionId)assert.equal(versionMap.get(v.parentVersionId)?.documentId,v.documentId);const seen=new Set([v.id]);let parent=v.parentVersionId;while(parent){assert(!seen.has(parent),'Cycle');seen.add(parent);parent=versionMap.get(parent)?.parentVersionId}for(const pin of v.referencePins)assert.equal(fileMap.get(pin.fileId)?.sha256,pin.sha256)}
for(const d of p.documents)if(d.currentVersionId)assert.equal(versionMap.get(d.currentVersionId)?.documentId,d.id);
for(const r of [...p.relations,...e.relations]){assert(versionMap.has(r.fromVersionId));assert(versionMap.has(r.toVersionId));assert.notEqual(r.fromVersionId,r.toVersionId)}
for(const pin of t.referencePins)assert.equal(fileMap.get(pin.fileId)?.sha256,pin.sha256);
assert.equal(e.outputs[0].version.parentVersionId,t.baseVersionId);
for(const f of files.filter(f=>/\.(md|json|html|mjs|sh|yml)$/.test(f))){const text=fs.readFileSync(f,'utf8');assert(!/\/Users\/littleseven\//.test(text),`Local user path in ${f}`);assert(!/gh[pousr]_[A-Za-z0-9]{30,}/.test(text),`Potential GitHub credential in ${f}`)}
console.log(`Starter checks passed: ${files.length} files, Markdown links, JSON parse, prototype JS/SVG, fixture IDs/references/hashes, basic publication hygiene.`);
console.log('Not a full JSON Schema validator or desktop application test; implement these in M1.');
