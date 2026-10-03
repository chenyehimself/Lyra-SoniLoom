import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as project from '../src/project.mjs';
import * as engine from '../src/engine.mjs';
import {encodeWav} from '../src/wav.mjs';
import {prepareProposal,applyProposal,projectContext} from '../src/ai-contract.mjs';
import {normalizeRequest} from '../server/ai.mjs';
const energy=(a,from=0,to=a.length)=>a.subarray(from,to).reduce((s,x)=>s+x*x,0);
const shot=()=>{const p=project.createProject();p.duration=3;p.layers=[{...project.createLayer('impact'),duration:.08,start:.1,attack:.001,release:.06,gain:.3,texture:1,wet:0}];return p;};
test('legacy saved projects keep exact pre-upgrade WAV hashes',()=>{
 for(const {path,sha256} of JSON.parse(readFileSync(new URL('../outputs/v0.3/legacy-baseline.json',import.meta.url)))){
 const p=JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
 assert.equal(createHash('sha256').update(Buffer.from(encodeWav(engine.renderProject(p).channels))).digest('hex'),sha256);
 }
});
test('new projects support independent spatial stems and bypass preserves source PCM',()=>{
 const p=shot();assert.equal(p.schemaVersion,3);
 const dry=engine.renderLayer(p.layers[0],p,{}),r=engine.renderProject(p);
 assert.deepEqual(r.channels,dry);assert.deepEqual(r.stems.dry,dry);
 assert.equal(energy(r.stems.early[0])+energy(r.stems.late[0]),0);
});
test('room edits are causal and deterministic, preserve dry and extend beyond clip',()=>{
 const p=shot(),base=engine.renderProject(p);Object.assign(p.layers[0],{roomEarly:.3,roomLate:.25,roomSize:6,roomDecay:.8,roomDamping:4500,roomPredelay:.02});
 const r=engine.renderProject(p);assert.ok(r.stems,'separate stems required');
 assert.deepEqual(r.stems.dry,base.channels);assert.deepEqual(r,engine.renderProject(p));
 for(const stem of ['early','late']){assert.equal(energy(r.stems[stem][0],0,4800),0);assert.ok(energy(r.stems[stem][0],12000)>0);}
 assert.ok(r.peak<1);assert.equal(r.clipped,0);
 const short=energy(r.stems.late[0],48000);p.layers[0].roomDecay=2;
 assert.ok(energy(engine.renderProject(p).stems.late[0],48000)>short*2);
 p.layers[0].gain=0;assert.equal(engine.renderProject(p).peak,0);
});
test('room proposals keep IDs, dry PCM, protected layers; reject invalid/locked/stale changes',()=>{
 const p=shot();p.layers.push({...project.createLayer('tone',1),duration:.2,gain:.05,locked:true});
 const s=new project.ProjectStore(p),id=p.layers[0].id,base=engine.renderProject(p);
 for(const [field,value] of [['roomEarly',.25],['roomDecay',1.4],['roomLate',.2]]){
 const plan=prepareProposal(s,{message:'Spatial edit',operations:[{kind:'edit',layerId:id,source:'',changes:[{field,value}]}]},{scope:id});
 assert.equal(plan.changes.length,1);applyProposal(s,plan);
 }
 const r=engine.renderProject(s.project);assert.deepEqual(r.stems.dry,base.stems.dry);assert.deepEqual(r.layers[p.layers[1].id],base.layers[p.layers[1].id]);
 assert.deepEqual(s.project.layers.map(l=>l.id),p.layers.map(l=>l.id));s.undo();assert.equal(s.project.layers[0].roomLate,undefined);s.redo();assert.equal(s.project.layers[0].roomLate,.2);
 assert.throws(()=>s.edit(id,{roomDecay:99}));assert.throws(()=>s.edit(p.layers[1].id,{roomEarly:.2}),/locked/);
 const stale=prepareProposal(s,{message:'',operations:[]});s.edit(id,{roomEarly:.1});assert.throws(()=>applyProposal(s,stale),/Stale/);
 assert.deepEqual(project.parseProject(project.serializeProject(s.project)),s.project);
 const normalized=normalizeRequest({prompt:'Only shorten the room tail',scope:id,history:[],project:projectContext(s.project)});assert.equal(normalized.project.layers[0].roomDecay,1.4);
});
test('legacy opt-in is undoable and never changes dry audio or silently adds spatial fields',()=>{
 const p=JSON.parse(readFileSync(new URL('../outputs/v0.3/garage-v02.soniloom.json',import.meta.url))),s=new project.ProjectStore(p),before=engine.renderProject(p);
 assert.throws(()=>s.edit(p.layers[0].id,{roomEarly:.2}),/upgrade|spatial|legacy/i);
 assert.equal(typeof s.enableSpatial,'function');s.enableSpatial();assert.equal(s.project.schemaVersion,2);assert.deepEqual(engine.renderProject(s.project).channels,before.channels);
 s.undo();assert.deepEqual(s.project,p);s.redo();assert.equal(s.project.schemaVersion,2);
});
test('comparison level matching attenuates louder versions without altering saved audio',async()=>{
 const mod=await import('../src/engine.mjs');assert.equal(typeof mod.comparisonGains,'function');
 const a=[Float32Array.of(.1,-.2),Float32Array.of(.1,-.2)],b=a.map(ch=>Float32Array.from(ch,x=>x*4));
 const gains=mod.comparisonGains(a,b);assert.equal(gains.current,1);assert.equal(gains.reference,.25);assert.equal(b[0][0],Math.fround(.4));
 assert.deepEqual(mod.comparisonGains(a,[new Float32Array(2),new Float32Array(2)]),{current:1,reference:1});
});
test('RMS matching uses the audible solo subset against the reference and preserves export PCM',()=>{
 const p=shot();p.layers=[{...project.createLayer('tone'),duration:.2,gain:.15},{...project.createLayer('tone'),duration:.2,gain:.15}];
 const r=engine.renderProject(p),before=structuredClone(r.channels);assert.equal(typeof engine.auditionChannels,'function');
 const options={reference:r,soloIds:[p.layers[0].id],match:true};
 const current=engine.auditionChannels(r,options),reference=engine.auditionChannels(r,{...options,referenceMode:true});
 assert.deepEqual(current,reference);assert.deepEqual(r.channels,before);
 assert.deepEqual(engine.auditionChannels(r,{component:'dry',...options}),r.stems.dry);
});
