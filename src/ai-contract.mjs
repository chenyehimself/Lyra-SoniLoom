import {createLayer,ProjectStore,TYPES,validateProject} from './project.mjs';

import {SAMPLE_FIELDS,measureAudio,validateAudioMetadata} from './sample.mjs';
import {decodeWav,fromBase64} from './wav.mjs';
import {ROOM_FIELDS} from './spatial.mjs';
export const EDIT_FIELDS=[...SAMPLE_FIELDS,...ROOM_FIELDS,'name','start','duration','gain','pan','frequency','endFrequency','cutoff','attack','release','texture','drive','delay','wet','rate','reverse','seed'];
const LAYER_FIELDS=['id','type','color','locked','assetId',...EDIT_FIELDS];
const exact=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).every(k=>keys.includes(k));
const preparedPlans=new WeakMap();
export const PROPOSAL_SCHEMA={type:'object',additionalProperties:false,required:['message','operations'],properties:{
 message:{type:'string'},operations:{type:'array',items:{type:'object',additionalProperties:false,required:['kind','layerId','source','changes'],properties:{
  kind:{type:'string',enum:['add','edit','remove','project']},layerId:{type:'string'},source:{type:'string',enum:['',...TYPES]},
  changes:{type:'array',items:{type:'object',additionalProperties:false,required:['field','value'],properties:{field:{type:'string',enum:[...EDIT_FIELDS,'assetId']},value:{anyOf:[{type:'string'},{type:'number'},{type:'boolean'}]}}}}
 }}}}};

/** This is the only project representation allowed to leave the device. */
export function projectContext(p){
 return {schemaVersion:p.schemaVersion,engine:p.engine,id:p.id,name:p.name,duration:p.duration,sampleRate:p.sampleRate,
  layers:p.layers.map(l=>Object.fromEntries(LAYER_FIELDS.filter(k=>l[k]!==undefined).map(k=>[k,l[k]]))),
  assets:Object.entries(p.assets).map(([id,a])=>{let audio;if(a.data){try{audio=measureAudio(decodeWav(fromBase64(a.data)));}catch{}}else if(a.audio)audio=validateAudioMetadata(a.audio);return {id,name:a.name,...(audio?{audio}:{})};})};
}
export function validateProposal(proposal){
 if(!exact(proposal,['message','operations'])||typeof proposal.message!=='string'||proposal.message.length>6000||!Array.isArray(proposal.operations)||proposal.operations.length>32)throw Error('Invalid AI proposal');
 for(const op of proposal.operations){
  if(!exact(op,['kind','layerId','source','changes'])||!['add','edit','remove','project'].includes(op.kind)||typeof op.layerId!=='string'||!['',...TYPES].includes(op.source)||!Array.isArray(op.changes)||op.changes.length>EDIT_FIELDS.length+1)throw Error('Invalid AI operation');
  const seen=new Set();for(const c of op.changes){
   if(!exact(c,['field','value'])||![...EDIT_FIELDS,'assetId'].includes(c.field)||seen.has(c.field)||!['string','number','boolean'].includes(typeof c.value)||(typeof c.value==='number'&&!Number.isFinite(c.value))||(typeof c.value==='string'&&c.value.length>200))throw Error('Unsupported AI edit field or value');seen.add(c.field);
  }
 }
 return proposal;
}
function buildCandidate(project,proposal,scope){
 const next=structuredClone(project),removedAssets=new Set();
 if(scope!=='all'&&!next.layers.some(l=>l.id===scope))throw Error('Selected layer no longer exists');
 for(const op of proposal.operations){
  const patch=Object.fromEntries(op.changes.map(c=>[c.field,c.value]));
  if(scope!=='all'&&(op.kind!=='edit'||op.layerId!==scope))throw Error('AI change is outside the selected layer scope');
  if(op.kind!=='add'&&op.source!=='')throw Error('Only added layers can specify a source');
  if(op.kind==='project'){
   if(op.layerId!==''||Object.keys(patch).some(k=>!['name','duration'].includes(k)))throw Error('Unsupported project change');Object.assign(next,patch);
  }else if(op.kind==='add'){
   if(op.layerId!==''||!TYPES.includes(op.source))throw Error('New layers receive their identity locally');
   if(op.source!=='sample'&&Object.hasOwn(patch,'assetId'))throw Error('Only samples can reference an asset');
   const l=createLayer(op.source,next.layers.length);l.duration=Math.min(2,next.duration);Object.assign(l,patch);next.layers.push(l);
  }else{
   const l=next.layers.find(l=>l.id===op.layerId);if(!l)throw Error('Unknown AI target layer');if(l.locked)throw Error(`Layer is locked: ${l.name}`);
   if(op.kind==='remove'){if(op.changes.length)throw Error('Remove must not include changes');if(l.type==='sample')removedAssets.add(l.assetId);next.layers=next.layers.filter(x=>x.id!==l.id);}
   else{if(Object.keys(patch).some(k=>!EDIT_FIELDS.includes(k)))throw Error('Unsupported edit field');Object.assign(l,patch);}
  }
 }
 const used=new Set(next.layers.filter(l=>l.type==='sample').map(l=>l.assetId));
 for(const id of removedAssets)if(!used.has(id))delete next.assets[id];
 validateProject(next);
 // Use the same authoritative protection checks as direct edits.
 const check=new ProjectStore(project);check.apply(p=>Object.assign(p,next),'AI proposal validation');
 return next;
}
export function describeChanges(before,after){
 const changes=[];
 for(const k of ['name','duration'])if(before[k]!==after[k])changes.push({target:'Sound',field:k,before:before[k],after:after[k]});
 for(const l of before.layers){const n=after.layers.find(x=>x.id===l.id);if(!n){changes.push({target:l.name,field:'remove',before:l.type,after:null});continue;}
  for(const k of EDIT_FIELDS)if(l[k]!==n[k])changes.push({target:l.name,field:k,before:l[k],after:n[k]});}
 for(const l of after.layers)if(!before.layers.some(x=>x.id===l.id))changes.push({target:l.name,field:'add',before:null,after:{...Object.fromEntries(['type',...EDIT_FIELDS].map(k=>[k,l[k]])),...(l.type==='sample'?{assetId:l.assetId,assetName:after.assets[l.assetId].name}:{})}});
 return changes;
}
export function prepareProposal(store,proposal,{scope='all'}={}){
 validateProposal(proposal);const before=store.project,next=buildCandidate(before,proposal,scope);
 const view={message:proposal.message,changes:describeChanges(before,next),generation:store.generation};
 preparedPlans.set(view,{store,generation:store.generation,next});return view;
}
export function applyProposal(store,prepared){
 const data=preparedPlans.get(prepared);
 if(!data||data.store!==store||data.generation!==store.generation)throw Error('Stale proposal: the sound changed. Send a new request.');
 const applied=store.apply(p=>Object.assign(p,structuredClone(data.next)),'Applied AI changes',data.generation);
 preparedPlans.delete(prepared);return applied;
}
