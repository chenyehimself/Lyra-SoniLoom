import {decodeWav,fromBase64,sha256} from './wav.mjs';
import {SAMPLE_FIELDS,sourceWindow} from './sample.mjs';
import {ROOM_FIELDS,ROOM_RANGES} from './spatial.mjs';
export const LEGACY_ENGINE='soniloom-dsp-0.1';
export const SPATIAL_ENGINE='soniloom-dsp-0.3';
export const ENGINE='soniloom-dsp-0.4';
export const TYPES=['tone','noise','mechanical','riser','impact','sample'];
export const COLORS=['#5885ff','#8c73f4','#55c9b0','#dbac67','#ed7793','#67b9dc'];
const clone=x=>structuredClone(x);
const number=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${label} must be ${min}–${max}`);};
export function createLayer(type='tone', index=0){
  return {id:crypto.randomUUID(),name:{tone:'Tonal body',noise:'Air texture',mechanical:'Mechanical motion',riser:'Energy buildup',impact:'Launch impact',sample:'Recorded source'}[type]||'Sound layer',type,color:COLORS[index%COLORS.length],start:0,duration:2,gain:.3,pan:0,frequency:110,endFrequency:220,cutoff:4000,attack:.02,release:.3,texture:.4,drive:0,delay:.14,wet:0,seed:421+index*73,locked:false,assetId:null,rate:1,reverse:false};
}
export function createProject(){
 const specs=[['mechanical',{name:'Mechanical ignition',start:0,duration:2.9,gain:.25,frequency:54,endFrequency:80,cutoff:1800,texture:.72,wet:.12}],['riser',{name:'Energy buildup',start:1.25,duration:3.25,gain:.27,frequency:65,endFrequency:980,cutoff:5400,attack:.4,release:.14,texture:.34,wet:.16}],['impact',{name:'Thruster release',start:4.5,duration:1.9,gain:.54,frequency:145,endFrequency:34,cutoff:2600,attack:.005,release:1.2,texture:.68,drive:.22,wet:.12}],['noise',{name:'Atmospheric tail',start:4.7,duration:3.3,gain:.17,cutoff:1100,attack:.15,release:2.8,texture:.65,wet:.48,delay:.28}]];
 return {schemaVersion:3,engine:ENGINE,id:crypto.randomUUID(),name:'Orbital departure',duration:9,sampleRate:48000,layers:specs.map(([t,v],i)=>({...createLayer(t,i),...v})),assets:{}};
}
export function validateProject(p){
 if(!p||!((p.schemaVersion===1&&p.engine===LEGACY_ENGINE)||(p.schemaVersion===2&&p.engine===SPATIAL_ENGINE)||(p.schemaVersion===3&&p.engine===ENGINE)))throw Error('Unsupported project schema or engine version');
 if(typeof p.id!=='string'||!p.id||typeof p.name!=='string'||p.name.length>100)throw Error('Invalid project identity');
 number(p.duration,.25,30,'Project duration');if(p.sampleRate!==48000)throw Error('Project sample rate must be 48000');
 if(!Array.isArray(p.layers)||p.layers.length>16)throw Error('Maximum 16 layers');
 if(!p.assets||typeof p.assets!=='object'||Array.isArray(p.assets))throw Error('Invalid asset map');
 const ids=new Set();
 for(const l of p.layers){
  if(!l||typeof l.id!=='string'||!l.id||ids.has(l.id))throw Error('Layer IDs must be unique');ids.add(l.id);
  if(!TYPES.includes(l.type))throw Error('Unsupported source module');
  if(typeof l.name!=='string'||l.name.length>100||!/^#[0-9a-f]{6}$/i.test(l.color))throw Error('Invalid layer label/color');
  for(const [k,a,b] of [['start',0,30],['duration',.05,30],['gain',0,1],['pan',-1,1],['frequency',20,8000],['endFrequency',20,8000],['cutoff',80,18000],['attack',.001,5],['release',.005,10],['texture',0,1],['drive',0,1],['delay',.03,.8],['wet',0,.65],['rate',.25,4],['seed',0,4294967295]]) number(l[k],a,b,k);
  if(!Number.isInteger(l.seed)||l.start+l.duration>p.duration+1e-8)throw Error('Layer must fit inside project duration; seed must be integer');
  for(const k of ROOM_FIELDS)if(Object.hasOwn(l,k)){if(p.schemaVersion===1)throw Error('Enable spatial upgrade before room edits on a legacy project');number(l[k],...ROOM_RANGES[k],k);}
  if(SAMPLE_FIELDS.some(k=>Object.hasOwn(l,k))){if(p.schemaVersion<3)throw Error('Enable sample editing upgrade before source selection');if(l.type!=='sample')throw Error('Source selection is only valid for sample layers');}
  if(typeof l.locked!=='boolean'||typeof l.reverse!=='boolean')throw Error('Invalid layer flags');
  if(l.type==='sample'&&(!l.assetId||!Object.hasOwn(p.assets,l.assetId)))throw Error('Missing source asset');
 }
 const decodedAssets={};let total=0;const entries=Object.entries(p.assets);if(entries.length>16)throw Error('Maximum 16 source assets');
 for(const [id,a] of entries){if(!/^[a-f0-9]{64}$/.test(id)||a?.hash!==id||typeof a.name!=='string'||a.name.length>200||typeof a.data!=='string')throw Error('Invalid asset identity');const d=decodeWav(fromBase64(a.data));decodedAssets[id]=d;total+=d.channels[0].length/d.sampleRate;}
 for(const l of p.layers)if(l.type==='sample'){const d=decodedAssets[l.assetId];sourceWindow(l,d.channels[0].length,d.sampleRate);}
 if(total>60)throw Error('Source assets exceed 60 seconds total');
 if(new TextEncoder().encode(JSON.stringify(p,null,2)).byteLength>70*1024*1024)throw Error('Project exceeds 70 MiB');return p;
}
export function serializeProject(p){validateProject(p);return JSON.stringify(p,null,2);}
export function parseProject(s){if(typeof s!=='string'||new TextEncoder().encode(s).byteLength>70*1024*1024)throw Error('Project exceeds 70 MiB');return validateProject(JSON.parse(s));}
export async function verifyAssets(p){for(const [id,a] of Object.entries(p.assets))if(await sha256(fromBase64(a.data))!==id)throw Error(`Source integrity mismatch: ${a.name}`);return p;}
export class ProjectStore{
 constructor(p){validateProject(p);this._project=clone(p);this.generation=0;this.past=[];this.future=[];this.lastAction='Opened project';}
 get project(){return clone(this._project);}get canUndo(){return this.past.length>0;}get canRedo(){return this.future.length>0;}
 apply(mutator,label,expected=this.generation,{unlockId=null}={}){
  if(expected!==this.generation)throw Error('Stale edit: project has changed');const before=this._project,next=clone(before);mutator(next);validateProject(next);
  if(before.layers.some(l=>l.locked)&&next.duration!==before.duration)throw Error('Project length is protected while layers are locked. Unlock layers before changing it.');
  for(const l of before.layers.filter(x=>x.locked)){const n=next.layers.find(x=>x.id===l.id);if(unlockId===l.id&&n){const copy={...n,locked:true};if(JSON.stringify(copy)!==JSON.stringify(l))throw Error('Unlock cannot change layer content');}else if(JSON.stringify(l)!==JSON.stringify(n))throw Error(`Layer is locked: ${l.name}`);}
  if(JSON.stringify(next)===JSON.stringify(before))return false;
  this.past.push({project:before,label:this.lastAction});if(this.past.length>40)this.past.shift();this.future=[];this._project=next;this.generation++;this.lastAction=label;return true;
 }
 edit(id,patch,expected=this.generation){const allowed=new Set([...SAMPLE_FIELDS,...ROOM_FIELDS,'name','start','duration','gain','pan','frequency','endFrequency','cutoff','attack','release','texture','drive','delay','wet','rate','reverse','seed']);if(Object.keys(patch).some(k=>!allowed.has(k)))throw Error('Unsupported edit field');return this.apply(p=>{const l=p.layers.find(l=>l.id===id);if(!l)throw Error('Unknown layer');if(l.locked)throw Error(`Layer is locked: ${l.name}`);Object.assign(l,patch);},'Edited layer',expected);}
 enableSpatial(){return this.apply(p=>{if(p.schemaVersion===1){p.schemaVersion=2;p.engine=SPATIAL_ENGINE;}},'Enabled spatial authoring');}
 enableSampleEditing(){return this.apply(p=>{p.schemaVersion=3;p.engine=ENGINE;},'Enabled sample editing');}
 lock(id,value){return this.apply(p=>{const l=p.layers.find(l=>l.id===id);if(!l)throw Error('Unknown layer');l.locked=value;},value?'Locked layer':'Unlocked layer',this.generation,{unlockId:value?null:id});}
 add(layer,asset){return this.apply(p=>{if(asset)p.assets[asset.hash]=asset;p.layers.push(clone(layer));},'Added layer');}
 remove(id){return this.apply(p=>{p.layers=p.layers.filter(l=>l.id!==id);const used=new Set(p.layers.filter(l=>l.type==='sample').map(l=>l.assetId));for(const key of Object.keys(p.assets))if(!used.has(key))delete p.assets[key];},'Removed layer');}
 undo(){if(!this.canUndo)return;this.future.push({project:this._project,label:this.lastAction});const old=this.past.pop();this._project=old.project;this.lastAction=old.label;this.generation++;}
 redo(){if(!this.canRedo)return;this.past.push({project:this._project,label:this.lastAction});const next=this.future.pop();this._project=next.project;this.lastAction=next.label;this.generation++;}
}
