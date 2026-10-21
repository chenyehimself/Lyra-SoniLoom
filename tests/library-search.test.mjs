import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {installedFixture} from './analysis-fixtures.mjs';
import {AnalysisStore} from '../server/analysis-store.mjs';
const mod=await import('../server/library-search.mjs').catch(()=>({}));
test('tag search ranks distinct semantic aliases and exposes only bounded source evidence',async()=>{assert.equal(typeof mod.LibrarySearch,'function');const {lib}=await installedFixture(),s=new mod.LibrarySearch(lib,new AnalysisStore(lib)),session=await s.begin();const r=await s.search(session.id,'pistol');assert.equal(r.candidates.length,2);assert.ok(r.candidates.every(c=>c.evidence==='bundle_tags_and_local_measurements'));const cloud=s.summaries(session.id);assert.equal(cloud.length,2);assert.equal(JSON.stringify(cloud).includes('assets/'),false);assert.equal(JSON.stringify(cloud).includes('sourceSha256'),false);assert.equal(cloud[0].semanticSource,'bundle_metadata');const clip=await s.clip(session.id,r.candidates[0].candidateId);assert.ok(clip.bytes.length>44);assert.ok(clip.sourceRef.firstFrame>0);});
test('third search is allowed, fourth rejected, invented candidates and missing matches fail without fallback',async()=>{assert.equal(typeof mod.LibrarySearch,'function');const {lib}=await installedFixture(),s=new mod.LibrarySearch(lib,new AnalysisStore(lib)),session=await s.begin();for(let i=0;i<3;i++)assert.equal((await s.search(session.id,'not-in-this-library')).candidates.length,0);await assert.rejects(s.search(session.id,'pistol'),/three|3/i);await assert.rejects(s.clip(session.id,'invented'),/candidate/i);});
test('source tampering or root changes invalidate materialization',async()=>{assert.equal(typeof mod.LibrarySearch,'function');const {lib,volume,dir}=await installedFixture(),s=new mod.LibrarySearch(lib,new AnalysisStore(lib)),session=await s.begin(),r=await s.search(session.id,'door');await writeFile(path.join(volume,'assets/1.wav'),Buffer.alloc(50));await assert.rejects(s.clip(session.id,r.candidates[0].candidateId),/hash|identity/i);await lib.configure(path.join(dir,'other'));await assert.rejects(s.search(session.id,'pistol'),/root|library/i);});
test('source mutation between verification and extraction cannot publish false provenance',async()=>{const {lib,volume}=await installedFixture(),s=new mod.LibrarySearch(lib,new AnalysisStore(lib)),session=await s.begin(),r=await s.search(session.id,'door'),original=lib.clip.bind(lib);lib.clip=async(...args)=>{const {readFile}=await import('node:fs/promises'),file=path.join(volume,'assets/1.wav'),bytes=await readFile(file);bytes.writeInt16LE(100,44+1000*2);await writeFile(file,bytes);return original(...args);};await assert.rejects(s.clip(session.id,r.candidates[0].candidateId),/changed|identity/i);});
test('zero-result synonym conjunction can be broadened to a single catalog source keyword',async()=>{const {lib}=await installedFixture(),s=new mod.LibrarySearch(lib,new AnalysisStore(lib)),session=await s.begin();const tooSpecific=await s.search(session.id,'single pistol gunshot dry isolated handgun one shot no reload no cocking');assert.equal(tooSpecific.totalMatches,0);const broadened=await s.search(session.id,'pistol');assert.equal(broadened.totalMatches,2);assert.equal(broadened.round,2);assert.ok(broadened.candidates.length);});

async function semanticFixture(names) {
 const f=await installedFixture();
 const file=path.join(f.lib.versionDir('team-test','0.1.0'),'catalog.json');
 const {readFile}=await import('node:fs/promises');
 const catalog=JSON.parse(await readFile(file,'utf8'));
 catalog.assets=names.map((item,i)=>({...catalog.assets[0],asset_id:`asset-${String(i).padStart(3,'0')}`,path:`assets/semantic-${i}.wav`,display_name:item.name,category:item.category||'Combat',subcategory:item.subcategory||'Gunshots',tags:item.tags||[],audio:{...catalog.assets[0].audio,embedded_description:item.description||''}}));
 catalog.archives[0].media_files=names.length;
 catalog.archives[0].uncompressed_media_bytes=f.bytes.length*names.length;
 for(const a of catalog.assets)await writeFile(path.join(f.volume,a.path),f.bytes);
 await writeFile(file,JSON.stringify(catalog));
 return f;
}

test('repeated foley does not crowd out distinct shot and reload evidence',async()=>{
 const {lib}=await semanticFixture([
  ...Array.from({length:8},(_,i)=>({name:`Gun Foley Pistol ${i+1}`,description:i===0?'Pistol, 9mm, Dry Fire':`Pistol mechanism variation ${i}`})),
  {name:'Gunshot Pistol',description:'Glock 23, Single Shot, Close Perspective'},
  {name:'Pistol Reload',description:'Magazine replacement'}
 ]);
 const s=new mod.LibrarySearch(lib,new AnalysisStore(lib)),session=await s.begin();
 const r=await s.search(session.id,'pistol');
 assert.ok(r.candidates.some(c=>c.name==='Gunshot Pistol'));
 assert.ok(r.candidates.some(c=>c.name==='Pistol Reload'));
 const summaries=s.summaries(session.id);
 assert.ok(summaries.some(c=>c.description.includes('Dry Fire')));
 assert.ok(summaries.some(c=>c.name==='Gunshot Pistol'&&c.description.includes('Single Shot')));
});

test('description-only evidence is searchable without interpreting it as recognition',async()=>{
 const {lib}=await semanticFixture([{name:'Recording 01',description:'Metal door latch closing',category:'Objects',subcategory:'Misc'}]);
 const s=new mod.LibrarySearch(lib,new AnalysisStore(lib)),session=await s.begin();
 const r=await s.search(session.id,'latch');
 assert.equal(r.totalMatches,1);
 assert.deepEqual(r.candidates[0].matchedFields,['description']);
 assert.equal(s.summaries(session.id)[0].semanticSource,'bundle_metadata');
 assert.equal(s.summaries(session.id)[0].measurementScope,'whole_source_not_selected_clip');
});

test('missing exact source can broaden to a family without inventing a substitute',async()=>{
 const {lib}=await semanticFixture([{name:'AK Shot',description:'Rifle gunshot'}]);
 const s=new mod.LibrarySearch(lib,new AnalysisStore(lib)),session=await s.begin();
 assert.equal((await s.search(session.id,'pistol')).totalMatches,0);
 const r=await s.search(session.id,'gunshot');
 assert.equal(r.totalMatches,1);
 assert.equal(r.candidates[0].name,'AK Shot');
});
