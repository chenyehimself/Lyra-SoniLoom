import {stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {assetRef} from './analysis-store.mjs';
import {hashFile,digest} from './audio-analysis.mjs';
import {inspectWav} from './library-audio.mjs';
const words=s=>s.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu)||[];
const stamp=s=>`${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;
const catalogKey=c=>digest(JSON.stringify(c.entries));
// Metadata is catalog evidence, never an acoustic classification.
export function rankCatalogCandidates(entries,query){
 const terms=[...new Set(words(query))];
 if(!terms.length)return [];
 const matches=entries.filter(e=>e.installed&&e.kind==='audio'&&e.audio?.channels<=2).map(e=>{
  const description=typeof e.audio?.embedded_description==='string'?e.audio.embedded_description:'';
  const fields={name:words(e.name),description:words(description),tags:words(e.tags.join(' ')),category:words(e.category),subcategory:words(e.subcategory)};
  const hits=t=>Object.keys(fields).filter(k=>fields[k].some(w=>w===t||w.startsWith(t)));
  const matchedFields=Object.keys(fields).filter(k=>terms.some(t=>hits(t).includes(k)));
  const score=terms.every(t=>hits(t).length)?terms.reduce((n,t)=>n+Math.max(...hits(t).map(k=>k==='tags'?3:['name','description'].includes(k)?2:1)),0):0;
  // Give distinct titles a turn before more takes of one title; this is not semantic recognition.
  const group=JSON.stringify([words(e.name).join(' ').replace(/(?: \d+)+$/,''),fields.category]);
  return {e,description,matchedFields,score,group};
 }).filter(x=>x.score).sort((a,b)=>b.score-a.score||a.e.assetId.localeCompare(b.e.assetId));
 const counts=new Map();
 for(const m of matches){m.groupPosition=counts.get(m.group)||0;counts.set(m.group,m.groupPosition+1);}
 return matches.sort((a,b)=>a.groupPosition-b.groupPosition||b.score-a.score||a.e.assetId.localeCompare(b.e.assetId));
}
/** Request-scoped candidates. Audio and source paths never enter cloud summaries. */
export class LibrarySearch{
 constructor(library,analysis){this.library=library;this.analysis=analysis;this.sessions=new Map();}
 async begin(){const catalog=await this.library.catalog();for(const [id,s]of this.sessions)if(Date.now()-s.created>20*60*1000)this.sessions.delete(id);if(this.sessions.size>=20)this.sessions.delete(this.sessions.keys().next().value);const s={id:randomUUID(),created:Date.now(),root:this.library.root,snapshotId:catalogKey(catalog),rounds:0,candidates:new Map(),trace:[],busy:false};this.sessions.set(s.id,s);return {id:s.id,snapshotId:s.snapshotId};}
 async session(id){const s=this.sessions.get(id);if(!s||Date.now()-s.created>20*60*1000)throw Error('Candidate session expired; search again');await this.library.init();if(s.root!==this.library.root)throw Error('Library root changed; search again');if(catalogKey(await this.library.catalog())!==s.snapshotId)throw Error('Library catalog changed; search again');return s;}
 async search(id,query,{signal}={}){const s=await this.session(id);if(s.busy)throw Error('A search is already running');if(s.rounds>=3)throw Error('Maximum three retrieval rounds reached');if(typeof query!=='string'||query.length>200||!words(query).length)throw Error('Use 1–200 characters of search terms');s.busy=true;s.rounds++;try{
  const matches=rankCatalogCandidates((await this.library.catalog()).entries,query);
  const candidates=[],warnings=[];let analysisSeconds=0;
  for(const {e,score,description,matchedFields}of matches.slice(0,5)){signal?.throwIfAborted();try{
   const {file}=await this.library.resolve(assetRef(e)),info=await inspectWav(file);if(info.unsupported){warnings.push(`${e.assetId}: unsupported format`);continue;}
   let found=await this.analysis.get(e);if(!found&&info.duration<=60&&analysisSeconds+info.duration<=120){analysisSeconds+=info.duration;found=await this.analysis.analyze(e,{signal});}
   const record=found?.record,maxFrames=Math.min(30*info.sampleRate,Math.floor((24*1024**2-46)/info.align)),regions=record?.segments.length?record.segments.slice(0,2):[{firstFrame:0,endFrame:info.frames,boundaryStatus:'unselected_start'}];
   for(const region of regions){const firstFrame=region.firstFrame,endFrame=Math.min(region.endFrame,firstFrame+maxFrames);const candidateId='candidate_'+randomUUID(),candidate={candidateId,name:e.name,description:description.slice(0,600),matchedFields,labels:{category:e.category,subcategory:e.subcategory,tags:e.tags.slice(0,12)},ref:{...assetRef(e),sourceSha256:e.sha256},firstFrame,endFrame,sourceSampleRate:info.sampleRate,duration:(endFrame-firstFrame)/info.sampleRate,analysisKey:record?.analysisKey??null,measurements:record?.measurements??null,evidence:record?'bundle_tags_and_local_measurements':'bundle_tags_only',boundaryStatus:region.boundaryStatus,rangeTruncated:endFrame<region.endFrame,score};s.candidates.set(candidateId,candidate);candidates.push(candidate);}
  }catch(e){if(signal?.aborted)throw e;warnings.push(e.code||e.message);}}
  await this.session(id);const result={sessionId:id,round:s.rounds,query,candidates,totalMatches:matches.length,truncated:matches.length>5,warnings};s.trace.push({round:s.rounds,query,totalMatches:matches.length,candidateCount:candidates.length,warnings});return result;
 }finally{s.busy=false;}}
 summaries(id){const s=this.sessions.get(id);if(!s)throw Error('Candidate session missing');return [...s.candidates.values()].map(c=>({candidateId:c.candidateId,semanticSource:'bundle_metadata',name:c.name.slice(0,200),description:c.description,matchedFields:c.matchedFields,category:c.labels.category.slice(0,100),subcategory:c.labels.subcategory.slice(0,100),tags:c.labels.tags.map(t=>t.slice(0,100)),duration:c.duration,boundaryStatus:c.boundaryStatus,rangeTruncated:c.rangeTruncated,measurementScope:'whole_source_not_selected_clip',measurements:c.measurements?{peakDbfs:c.measurements.peakDbfs,rmsDbfs:c.measurements.rmsDbfs,crestDb:c.measurements.crestDb,activityThresholdDbfs:c.measurements.activityThresholdDbfs,bandEnergyEstimate:c.measurements.bandEnergyEstimate}:null,limitations:['No semantic listening performed','Recording space and noise identity are unknown']}));}
 async clip(id,candidateId,{signal}={}){const s=await this.session(id),c=s.candidates.get(candidateId);if(!c)throw Error('Unknown candidate');const {file,asset}=await this.library.resolve(c.ref),before=stamp(await stat(file));if(asset.sha256!==c.ref.sourceSha256||await hashFile(file,{signal})!==c.ref.sourceSha256)throw Error('Source hash does not match candidate identity');signal?.throwIfAborted();const clip=await this.library.clip(c.ref,c.firstFrame,c.endFrame);if(stamp(await stat(file))!==before)throw Error('Source changed during extraction');await this.session(id);return {...clip,name:c.name,candidateId};}
 async details(id,ids){const s=await this.session(id);return ids.map(cid=>{const c=s.candidates.get(cid);if(!c)throw Error('Unknown candidate');return c;});}
}
