import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,ProjectStore} from '../src/project.mjs';
import * as ai from '../src/ai-contract.mjs';
import {renderProject} from '../src/engine.mjs';
const op=(id,field,value)=>({kind:'edit',layerId:id,source:'',changes:[{field,value}]});
const proposal=operations=>({message:'A precise change',operations});
test('AI applies an atomic scoped edit, keeps untouched PCM, and undoes as one revision',()=>{
 assert.equal(typeof ai.prepareProposal,'function');
 const s=new ProjectStore(createProject()),p=s.project,id=p.layers[1].id;
 const prepared=ai.prepareProposal(s,proposal([op(id,'cutoff',2800),op(id,'duration',3.6)]),{scope:id});
 assert.equal(s.generation,0);assert.equal(prepared.changes.length,2);
 ai.applyProposal(s,prepared);assert.equal(s.generation,1);assert.equal(s.project.layers[1].cutoff,2800);
 assert.deepEqual(renderProject(p).layers[p.layers[2].id],renderProject(s.project).layers[p.layers[2].id]);
 s.undo();assert.deepEqual(s.project,p);s.redo();assert.equal(s.project.layers[1].duration,3.6);
});
test('AI rejects protected, out-of-scope, unknown and invalid edits without partial changes',()=>{
 const s=new ProjectStore(createProject()),p=s.project,id=p.layers[0].id;s.lock(id,true);const before=s.project;
 for(const operations of [[op(id,'gain',.2)],[op(p.layers[1].id,'gain',.2)],[op(id,'locked',false)],[op('unknown','gain',.2)],[op(id,'gain',NaN)]]) assert.throws(()=>ai.prepareProposal(s,proposal(operations),{scope:id}));
 assert.deepEqual(s.project,before);
});
test('AI rejects stale proposals even after undo restores the same content or project replacement',()=>{
 const s=new ProjectStore(createProject()),id=s.project.layers[0].id,p=ai.prepareProposal(s,proposal([op(id,'gain',.2)]));
 s.edit(id,{gain:.4});s.undo();assert.throws(()=>ai.applyProposal(s,p),/Stale/);
 const other=new ProjectStore(s.project);assert.throws(()=>ai.applyProposal(other,p),/Stale/);
});
test('AI addition gets owned identity; metadata projection never includes WAV bytes or arbitrary fields',()=>{
 const s=new ProjectStore(createProject()),p=proposal([{kind:'add',layerId:'',source:'tone',changes:[{field:'name',value:'New tone'},{field:'gain',value:.12}]}]);
 ai.applyProposal(s,ai.prepareProposal(s,p));assert.equal(s.project.layers.length,5);assert.ok(s.project.layers[4].id);
 const view=ai.projectContext({...s.project,secret:'NO',assets:{x:{data:'SECRET_AUDIO',hash:'x',name:'a'}}});
 assert.equal(JSON.stringify(view).includes('SECRET_AUDIO'),false);assert.equal(JSON.stringify(view).includes('NO'),false);
});
test('invalid final operation rejects the entire proposal and an empty proposal has no revision',()=>{
 const s=new ProjectStore(createProject()),before=s.project,id=before.layers[1].id;
 assert.throws(()=>ai.prepareProposal(s,proposal([op(id,'gain',.1),op(id,'duration',99)])),/duration|Duration/);assert.deepEqual(s.project,before);
 assert.equal(ai.applyProposal(s,ai.prepareProposal(s,proposal([]))),false);assert.equal(s.generation,0);
});
test('AI edits imported audio by parameters without altering source bytes',async()=>{
 const {importWav}=await import('../src/assets.mjs'),{encodeWav}=await import('../src/wav.mjs');
 const s=new ProjectStore(createProject()),imported=await importWav(encodeWav([Float32Array.from({length:4800},(_,i)=>Math.sin(i*.1)*.2)]),'test.wav',s.project);
 s.add(imported.layer,imported.asset);const bytes=s.project.assets[imported.asset.hash].data;
 ai.applyProposal(s,ai.prepareProposal(s,proposal([op(imported.layer.id,'rate',.8)]),{scope:imported.layer.id}));
 assert.equal(s.project.assets[imported.asset.hash].data,bytes);assert.equal(s.project.layers.at(-1).assetId,imported.asset.hash);
});
test('sample additions disclose the exact asset identity and filename in approval changes',async()=>{
 const {importWav}=await import('../src/assets.mjs'),{encodeWav}=await import('../src/wav.mjs');
 const s=new ProjectStore(createProject());
 const a=await importWav(encodeWav([new Float32Array(4800).fill(.1)]),'recording-a.wav',s.project);
 const b=await importWav(encodeWav([new Float32Array(4800).fill(.2)]),'recording-b.wav',s.project);
 s.add(a.layer,a.asset);s.add(b.layer,b.asset);
 const add=id=>ai.prepareProposal(s,proposal([{kind:'add',layerId:'',source:'sample',changes:[{field:'name',value:'Recorded layer'},{field:'assetId',value:id}]}]));
 const one=add(a.asset.hash),two=add(b.asset.hash);assert.notDeepEqual(one.changes,two.changes);
 assert.equal(one.changes[0].after.assetId,a.asset.hash);assert.equal(one.changes[0].after.assetName,'recording-a.wav');
});
test('scoped AI edits preserve existing unreferenced source assets',async()=>{
 const {importWav}=await import('../src/assets.mjs'),{encodeWav}=await import('../src/wav.mjs');const p=createProject();
 const a=await importWav(encodeWav([new Float32Array(4800).fill(.1)]),'retained.wav',p);p.assets[a.asset.hash]=a.asset;
 const s=new ProjectStore(p),id=p.layers[0].id;ai.applyProposal(s,ai.prepareProposal(s,proposal([op(id,'gain',.2)]),{scope:id}));
 assert.deepEqual(s.project.assets,p.assets);
});
