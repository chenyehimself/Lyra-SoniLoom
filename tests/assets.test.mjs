import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,createLayer,ProjectStore,serializeProject,parseProject,verifyAssets} from '../src/project.mjs';
import {encodeWav,toBase64,sha256} from '../src/wav.mjs';
import {renderProject} from '../src/engine.mjs';
const importApi=await import('../src/assets.mjs').catch(()=>({}));
test('WAV imports with content identity, portable bytes, and deterministic reopen',async()=>{
 assert.equal(typeof importApi.importWav,'function','import operation exists');
 const source=Float32Array.from({length:8000},(_,i)=>Math.sin(i*.05)*.3);const bytes=encodeWav([source],8000);
 const {asset,layer}=await importApi.importWav(bytes,'tap.wav',createProject());
 assert.equal(asset.hash,await sha256(bytes));assert.equal(asset.data,toBase64(bytes));assert.equal(layer.duration,1);
 const s=new ProjectStore(createProject());s.add(layer,asset);const next=parseProject(serializeProject(s.project));await verifyAssets(next);
 const a=renderProject(s.project,{onlyLayerId:layer.id}),b=renderProject(next,{onlyLayerId:layer.id});assert.deepEqual(a.channels,b.channels);assert(a.peak>.01);
 next.assets[asset.hash].data=toBase64(encodeWav([source.map(v=>v*.5)],8000));await assert.rejects(verifyAssets(next),/integrity/);
});
test('locks prevent deletion and unsupported edit fields cannot bypass protection',()=>{
 const s=new ProjectStore(createProject()),id=s.project.layers[0].id;s.lock(id,true);assert.throws(()=>s.remove(id),/locked/);assert.throws(()=>s.edit(id,{locked:false}),/Unsupported/);s.lock(id,false);s.remove(id);assert.equal(s.project.layers.length,3);
});
test('full mix equals the sum of independently rendered layers without hidden normalization',()=>{
 const p=createProject(),mixed=renderProject(p);const sum=new Float32Array(mixed.channels[0].length);
 for(const l of p.layers){const part=renderProject(p,{onlyLayerId:l.id});for(let i=0;i<sum.length;i++)sum[i]+=part.channels[0][i];}
 assert.deepEqual(sum,mixed.channels[0]);assert.equal(mixed.clipped,0);
});
test('locked layers prevent global duration edits that could change their rendered tails',()=>{
 const s=new ProjectStore(createProject());s.lock(s.project.layers[2].id,true);
 assert.throws(()=>s.apply(p=>p.duration=10,'Change duration'),/locked|protected/i);
 assert.equal(s.project.duration,9);
});
test('removing the last sample reference releases its asset and undo restores original bytes',async()=>{
 const s=new ProjectStore(createProject());const {asset,layer}=await importApi.importWav(encodeWav([Float32Array.from([0,.2,0])],8000),'tiny.wav',s.project);
 s.add(layer,asset);s.remove(layer.id);assert.equal(Object.keys(s.project.assets).length,0);
 s.undo();assert.equal(s.project.assets[asset.hash].data,asset.data);
});
test('accepted project states never exceed the portable reopen limit',async()=>{
 const p=createProject(),frames=12*192000,bytes=new ArrayBuffer(44+frames*2*4);
 new Uint8Array(bytes,0,44).set(new Uint8Array(encodeWav([new Float32Array(1),new Float32Array(1)],192000),0,44));
 const v=new DataView(bytes);v.setUint32(4,bytes.byteLength-8,true);v.setUint16(20,3,true);v.setUint32(28,192000*8,true);v.setUint16(32,8,true);v.setUint16(34,32,true);v.setUint32(40,frames*8,true);
 for(let i=0;i<3;i++){v.setFloat32(bytes.byteLength-4,.1+i*.1,true);const hash=await sha256(bytes);p.assets[hash]={hash,name:`large-${i}.wav`,data:toBase64(bytes)};}
 assert.throws(()=>new ProjectStore(p),/70 MiB/);
});
