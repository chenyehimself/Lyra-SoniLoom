import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import * as project from '../src/project.mjs';import {importWav} from '../src/assets.mjs';import {renderProject} from '../src/engine.mjs';import {encodeWav} from '../src/wav.mjs';import {projectContext,prepareProposal,applyProposal} from '../src/ai-contract.mjs';import {normalizeRequest} from '../server/ai.mjs';
async function fixture(outside=.7){const p=project.createProject();p.duration=2;p.layers=[];const wave=Float32Array.from({length:8000},(_,i)=>i>=2000&&i<6000?Math.sin(i*.07)*.2:outside);const a=await importWav(encodeWav([wave],8000),'short-take.wav',p);p.layers=[a.layer];p.assets={[a.asset.hash]:a.asset};return p;}
const energy=a=>a.reduce((s,x)=>s+x*x,0);
test('schema1/2 projects and imported source playback preserve frozen hashes',()=>{for(const {path,sha256}of JSON.parse(readFileSync(new URL('../outputs/v0.4/legacy-baseline.json',import.meta.url))))assert.equal(createHash('sha256').update(Buffer.from(encodeWav(renderProject(JSON.parse(readFileSync(new URL('../'+path,import.meta.url)))).channels))).digest('hex'),sha256);});
test('new imports expose a non-destructive full source window',async()=>{const p=await fixture();assert.equal(p.schemaVersion,3);assert.equal(p.layers[0].sourceIn,0);assert.equal(p.layers[0].sourceOut,1);assert.equal(p.layers[0].duration,1);});
test('crop never reads excluded audio, even reversed and at fractional speed; tail fades at selection end',async()=>{
 const a=await fixture(.9),b=await fixture(-.9);
 for(const reverse of [false,true])for(const rate of [.75,1.37,4]){
  for(const p of [a,b])Object.assign(p.layers[0],{sourceIn:.25,sourceOut:.75,reverse,rate,duration:1.5,wet:0,roomEarly:0,roomLate:0});
  const ra=renderProject(a),rb=renderProject(b);assert.equal(createHash('sha256').update(Buffer.from(ra.channels[0].buffer)).digest('hex'),createHash('sha256').update(Buffer.from(rb.channels[0].buffer)).digest('hex'));assert.ok(energy(ra.channels[0])>0);assert.equal(energy(ra.channels[0].subarray(Math.ceil(.5/rate*48000))),0);
 }
});
test('sample bounds, original bytes, locked content, undo and persisted rendering stay authoritative',async()=>{
 const p=await fixture(),s=new project.ProjectStore(p),id=p.layers[0].id,assetId=p.layers[0].assetId;
 s.edit(id,{sourceIn:.25,sourceOut:.75});assert.equal(s.project.assets[assetId].data,p.assets[assetId].data);
 const saved=project.serializeProject(s.project);assert.deepEqual(renderProject(project.parseProject(saved)).channels,renderProject(s.project).channels);s.undo();assert.deepEqual(s.project,p);s.redo();
 for(const patch of [{sourceIn:-.1},{sourceOut:1.1},{sourceIn:.8},{sourceOut:.25},{sourceIn:NaN}])assert.throws(()=>s.edit(id,patch));
 s.lock(id,true);assert.throws(()=>s.edit(id,{sourceIn:.3}),/locked/);assert.equal(s.project.layers[0].sourceIn,.25);
});
test('AI can trim only the selected source with bounded numeric metadata and no raw audio',async()=>{
 const p=await fixture(),s=new project.ProjectStore(p),id=p.layers[0].id,ctx=projectContext(p);assert.equal(ctx.assets[0].audio.duration,1);assert.equal(ctx.assets[0].audio.sampleRate,8000);assert.ok(ctx.assets[0].audio.peak>0);assert.equal(JSON.stringify(ctx).includes(p.assets[p.layers[0].assetId].data),false);
 const request=normalizeRequest({prompt:'Keep .25 to .75 seconds of this recording',project:ctx,scope:id,history:[]});assert.equal(request.project.assets[0].audio.duration,1);
 const proposal={message:'Proposed trim',operations:[{kind:'edit',layerId:id,source:'',changes:[{field:'sourceIn',value:.25},{field:'sourceOut',value:.75}]}]};applyProposal(s,prepareProposal(s,proposal,{scope:id}));assert.equal(s.project.layers[0].assetId,p.layers[0].assetId);assert.deepEqual(s.project.assets,p.assets);
 const before=s.project;proposal.operations[0].changes[1].value=9;assert.throws(()=>prepareProposal(s,proposal,{scope:id}));assert.deepEqual(s.project,before);
});
test('legacy sample edit opt-in is explicit, undoable and render neutral until trimming',()=>{
 const p=JSON.parse(readFileSync(new URL('../outputs/v0.4/legacy-sample.soniloom.json',import.meta.url))),s=new project.ProjectStore(p),before=renderProject(p);
 assert.throws(()=>s.edit(p.layers[0].id,{sourceIn:.2,sourceOut:.7}),/upgrade|sample editing/i);
 assert.equal(typeof s.enableSampleEditing,'function');s.enableSampleEditing();assert.equal(s.project.schemaVersion,3);assert.deepEqual(renderProject(s.project).channels,before.channels);s.undo();assert.deepEqual(s.project,p);
});
test('waveform drag converts either direction to bounded source sample frames',async()=>{
 const m=await import('../src/sample.mjs');assert.equal(typeof m.selectionFromDrag,'function');
 assert.deepEqual(m.selectionFromDrag(75,25,100,8000,8000),{sourceIn:.25,sourceOut:.75});assert.deepEqual(m.selectionFromDrag(-30,120,100,8000,8000),{sourceIn:0,sourceOut:1});assert.throws(()=>m.selectionFromDrag(50,50,100,8000,8000));
});
test('metadata is numeric, silence-safe, and rejects malformed positions before a provider call',async()=>{
 const {measureAudio,validateAudioMetadata}=await import('../src/sample.mjs');
 const empty=measureAudio({sampleRate:48000,channels:[new Float32Array(480)]});assert.equal(empty.peakTime,null);assert.equal(empty.amplitudeOnset,null);assert.deepEqual(validateAudioMetadata({...empty,data:'DO_NOT_FORWARD'}),empty);
 for(const patch of [{frames:1.2},{sampleRate:NaN},{duration:9},{peak:Infinity},{peakTime:-1},{amplitudeOnset:1}])assert.throws(()=>validateAudioMetadata({...empty,...patch}));
 const p=await fixture(),ctx=projectContext(p);ctx.assets[0].audio.peakTime=-1;assert.throws(()=>normalizeRequest({prompt:'trim',scope:'all',project:ctx,history:[]}));
});
test('source selection is sample-only, paired, schema guarded and cannot disable room after upgrade',async()=>{
 const p=await fixture();for(const patch of [{sourceIn:.1,sourceOut:undefined},{sourceIn:.1,sourceOut:.100000001},{sourceIn:'0',sourceOut:.5}]){const bad=structuredClone(p);Object.assign(bad.layers[0],patch);assert.throws(()=>project.validateProject(bad));}
 const synth=project.createProject();Object.assign(synth.layers[0],{sourceIn:0,sourceOut:.5});assert.throws(()=>project.validateProject(synth),/sample/);
 const s=new project.ProjectStore(p);s.edit(p.layers[0].id,{roomEarly:.3});const before=s.project;s.enableSpatial();assert.deepEqual(s.project,before);assert.ok(renderProject(s.project).stems.early[0].some(x=>x!==0));
});

test('one-frame selection retains identical interpolation when reversed at fractional rates',async()=>{
 const p=await fixture();Object.assign(p.layers[0],{sourceIn:.25,sourceOut:.250125,rate:.25,wet:0,reverse:false});const forward=renderProject(p).channels;p.layers[0].reverse=true;assert.deepEqual(renderProject(p).channels,forward);
});
