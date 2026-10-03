import {writeFile,mkdir} from 'node:fs/promises';
import {createProject,ProjectStore,serializeProject} from '../src/project.mjs';
import {renderProject} from '../src/engine.mjs';
import {encodeWav} from '../src/wav.mjs';
import {importWav} from '../src/assets.mjs';
await mkdir(new URL('../outputs/',import.meta.url),{recursive:true});
const base=createProject();base.layers.forEach((l,i)=>l.id=`layer-${i+1}`);base.id='orbital-departure-demo';
const s=new ProjectStore(base);s.lock('layer-3',true);const before=s.project;s.edit('layer-2',{duration:3.6,cutoff:2800,endFrequency:700});const after=s.project;
const evidence={engine:base.engine,sampleRate:base.sampleRate,duration:base.duration,changes:{layer:'layer-2',duration:[3.25,3.6],cutoff:[5400,2800],endFrequency:[980,700]},protectedLayer:'layer-3'};
for(const [name,p]of [['orbital-before',before],['orbital-after',after]]){const r=renderProject(p);await writeFile(new URL(`../outputs/${name}.wav`,import.meta.url),new Uint8Array(encodeWav(r.channels)));await writeFile(new URL(`../outputs/${name}.soniloom.json`,import.meta.url),serializeProject(p));evidence[name]={peak:r.peak,rms:r.rms,clippedSamples:r.clipped,frames:r.channels[0].length};}
const a=renderProject(before,{onlyLayerId:'layer-3'}),b=renderProject(after,{onlyLayerId:'layer-3'});evidence.protectedLayerIdentical=a.channels.every((c,j)=>c.every((v,i)=>v===b.channels[j][i]));
const sr=48000,tap=Float32Array.from({length:sr},(_,i)=>{const t=i/sr;return Math.sin(2*Math.PI*(240*t-60*t*t))*.5*Math.exp(-t*24)*(1-Math.exp(-t*1500));});
await writeFile(new URL('../work/import-test-tap.wav',import.meta.url),new Uint8Array(encodeWav([tap],sr)));
await writeFile(new URL('../outputs/audio-evidence.json',import.meta.url),JSON.stringify(evidence,null,2));console.log(evidence);

const recorded=createProject();recorded.name='Synthetic tap import example';recorded.layers=[];const imported=await importWav(encodeWav([tap],sr),'synthetic-tap.wav',recorded);recorded.layers.push(imported.layer);recorded.assets[imported.asset.hash]=imported.asset;await writeFile(new URL('../outputs/recording-example.soniloom.json',import.meta.url),serializeProject(recorded));
