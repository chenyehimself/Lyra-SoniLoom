import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {skillInstructions} from '../server/skills.mjs';
import {createAI} from '../server/ai.mjs';
import {createProject} from '../src/project.mjs';
import {projectContext} from '../src/ai-contract.mjs';

test('fixed role bundles include professional references, exclude examples and reject paths',()=>{
 const luna=skillInstructions('luna'),sol=skillInstructions('sol');
 assert.match(luna,/Intent understanding/);assert.doesNotMatch(luna,/Engine and editing/);
 for(const title of ['Sound design planning','Source selection','Evidence and analysis','Engine and editing'])assert.ok(sol.includes(title));
 assert.doesNotMatch(sol,/Scenario acceptance matrix/);
 assert.throws(()=>skillInstructions('../README.md'),/Unknown skill role/);
 for(const text of [luna,sol])assert.doesNotMatch(text,/[\u3400-\u9fff]/);
});

test('legacy and coordinated requests receive skills with distinct call contracts',async()=>{
 const seen=[];const decision={action:'unavailable',query:'',reason:'No suitable source',proposal:{message:'No suitable source',operations:[]}};
 const ai=createAI({key:'TEST',budget:{reserve:()=>1,settle:()=>{},status:()=>({})},roleProvider:{invoke:async(role,payload)=>{seen.push(payload);return {decision,providerMeta:{}};}},fetchImpl:async(_,o)=>{seen.push(JSON.parse(o.body));return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(decision)}]}]}));}});
 const request={prompt:'A pistol shot in a garage',project:projectContext(createProject()),scope:'all',history:[]};
 const libraryContext={round:0,candidates:[],lastSearch:null};
 await ai.generate(request,{libraryContext,professionalContext:{remaining:{sol:2},librarySummaryConsent:true}});
 await ai.generate(request,{libraryContext});
 assert.match(seen[0].instructions,/at most two searches/i);assert.doesNotMatch(seen[0].instructions,/at most four Sol/);
 assert.match(seen[1].instructions,/at most four Sol/);
 for(const p of seen){assert.match(p.instructions,/Dry Fire/);assert.match(p.instructions,/roomEarly/);assert.ok(Buffer.byteLength(JSON.stringify(p))<64*1024);}
});


test('missing or empty required files fail closed in an isolated copy',async()=>{
 const root=mkdtempSync(join(tmpdir(),'soniloom-skills-'));
 mkdirSync(join(root,'server'));copyFileSync(new URL('../server/skills.mjs',import.meta.url),join(root,'server/skills.mjs'));
 const {skillInstructions:load}=await import(pathToFileURL(join(root,'server/skills.mjs')));
 assert.throws(()=>load('luna'),/Required application skill unavailable/);
 mkdirSync(join(root,'skills/intent-understanding'),{recursive:true});writeFileSync(join(root,'skills/intent-understanding/SKILL.md'),' ');
 assert.throws(()=>load('luna'),/Required application skill empty/);
 writeFileSync(join(root,'skills/intent-understanding/SKILL.md'),'Valid fixture');assert.equal(load('luna'),'Valid fixture');
});
