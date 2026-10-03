import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createProject,createLayer,ProjectStore,serializeProject,parseProject} from '../src/project.mjs';
import {renderProject,comparisonGains} from '../src/engine.mjs';
import {encodeWav} from '../src/wav.mjs';
const root=new URL('../outputs/v0.3/',import.meta.url);mkdirSync(root,{recursive:true});
const report=[];
function save(name,p){
 const r=renderProject(p);assert.equal(r.clipped,0);assert.ok(r.peak>0);
 const wav=Buffer.from(encodeWav(r.channels));writeFileSync(new URL(name+'.wav',root),wav);
 const text=serializeProject(p);writeFileSync(new URL(name+'.soniloom.json',root),text);
 assert.deepEqual(Buffer.from(encodeWav(renderProject(parseProject(text)).channels)),wav);
 report.push({name,peak:r.peak,rms:r.rms,clipped:r.clipped,sha256:createHash('sha256').update(wav).digest('hex')});return r;
}
const old=JSON.parse(readFileSync(new URL('garage-v02.soniloom.json',root)));save('garage-v02',old);
const s=new ProjectStore(old);s.enableSpatial();
// Controlled ablation: retain the original AI-designed muzzle and body. Exclude the old synthetic reflection/tail layers.
s.apply(p=>{p.layers=p.layers.slice(0,2);p.layers.forEach(l=>l.wet=0);p.name='Garage shot · dry source';},'Prepared dry source comparison');
const dry=s.project,rDry=save('garage-dry',dry);
s.apply(p=>{p.name='Garage shot · spatial v0.3';for(const l of p.layers)Object.assign(l,{roomEarly:.38,roomLate:.24,roomSize:5.5,roomDecay:1.05,roomDamping:4200,roomPredelay:.008});},'Added per-layer garage space');
const spatial=s.project,rRoom=save('garage-room',spatial);assert.deepEqual(rDry.channels,rRoom.stems.dry);
for(const part of ['early','late'])writeFileSync(new URL(`garage-${part}.wav`,root),new Uint8Array(encodeWav(rRoom.stems[part])));
const gains=comparisonGains(rDry.channels,rRoom.channels);
for(const [name,r,g] of [['garage-dry-matched',rDry,gains.current],['garage-room-matched',rRoom,gains.reference]])writeFileSync(new URL(name+'.wav',root),new Uint8Array(encodeWav(r.channels.map(ch=>Float32Array.from(ch,x=>x*g)))));
const metal=createProject();metal.name='Metal strike · procedural approximation';metal.duration=4;metal.layers=[{...createLayer('impact'),name:'Impact',duration:.14,start:.2,frequency:730,endFrequency:480,texture:.85,cutoff:15000,gain:.22,attack:.001,release:.1,roomEarly:.2,roomLate:.18,roomDecay:1.4},{...createLayer('tone',1),name:'Resonant ring',duration:1.1,start:.205,frequency:1733,endFrequency:1710,texture:.6,gain:.04,attack:.002,release:1.05,roomEarly:.2,roomLate:.15,roomDamping:6000}];save('metal-room',metal);
const sci=createProject();sci.layers.forEach(l=>Object.assign(l,{roomEarly:.12,roomLate:.1,roomDecay:.7,roomDamping:4000}));save('orbital-room',sci);
writeFileSync(new URL('render-evidence.json',root),JSON.stringify({dryUnchanged:true,comparison:'Dry source vs same dry source plus v0.3 room. Compared to the complete v0.2 mix, old fake spatial layers and legacy delays are removed; this is NOT a source-only ablation.',rmsMatching:gains,files:report},null,2));
console.log(JSON.stringify(report));
