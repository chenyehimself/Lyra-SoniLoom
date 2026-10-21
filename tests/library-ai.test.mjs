import test from 'node:test';
import assert from 'node:assert/strict';
import {createAI} from '../server/ai.mjs';
import {Budget} from '../server/budget.mjs';
import {createProject} from '../src/project.mjs';
import {projectContext} from '../src/ai-contract.mjs';
import {installedFixture} from './analysis-fixtures.mjs';
import {AnalysisStore} from '../server/analysis-store.mjs';
import {LibrarySearch} from '../server/library-search.mjs';
import path from 'node:path';
const mod=await import('../server/arrangement.mjs').catch(()=>({}));
const request=()=>({prompt:'A pistol shot in a garage',scope:'all',project:projectContext(createProject()),history:[],librarySummaryConsent:true});
const decision=(action,query='',proposal={message:'No changes',operations:[]})=>({action,query,reason:'Catalog tags, not listening',proposal});
function response(d){return new Response(JSON.stringify({status:'completed',id:'test_response',usage:{input_tokens:10,output_tokens:10},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(d)}]}]}));}
test('real coordinator uses bounded local search and sends no raw catalog or paths to provider',async()=>{assert.equal(typeof mod.ArrangementService,'function');const {lib,dir}=await installedFixture(),search=new LibrarySearch(lib,new AnalysisStore(lib)),budget=new Budget(path.join(dir,'ledger.jsonl'));let calls=0;const ai=createAI({key:'TEST',budget,fetchImpl:async(_,o)=>{calls++;const payload=JSON.parse(o.body);assert.equal(o.body.includes(dir),false);assert.equal(o.body.includes('assets/0.wav'),false);assert.equal(o.body.includes('sourceSha256'),false);const context=JSON.parse(payload.input.at(-1).content);if(calls===1)return response(decision('search','pistol'));assert.equal(context.library.candidates[0].semanticSource,'bundle_metadata');const id=context.library.candidates[0].candidateId;return response(decision('arrange','',{message:'Use a tagged candidate',operations:[{kind:'add',layerId:'',source:'sample',changes:[{field:'assetId',value:id},{field:'duration',value:.5}]}]}));}});const service=new mod.ArrangementService(ai,search),result=await service.generate(request());assert.equal(result.trace.length,1);assert.equal(result.candidates.length,1);assert.equal(calls,2);assert.equal(budget.status().requests,2);});
test('three retrieval rounds include initial search; fourth search never executes',async()=>{assert.equal(typeof mod.ArrangementService,'function');const {lib,dir}=await installedFixture(),search=new LibrarySearch(lib,new AnalysisStore(lib));let calls=0;const ai=createAI({key:'TEST',budget:new Budget(path.join(dir,'ledger')),fetchImpl:async()=>{calls++;return response(decision('search','no-match'));}}),service=new mod.ArrangementService(ai,search);await assert.rejects(service.generate(request()),/three|3/i);assert.equal(calls,4);assert.equal([...search.sessions.values()][0].rounds,3);});
test('missing consent, provider error and cancellation cause no retries or hidden calls',async()=>{assert.equal(typeof mod.ArrangementService,'function');const {lib,dir}=await installedFixture(),search=new LibrarySearch(lib,new AnalysisStore(lib));let calls=0;const ai=createAI({key:'TEST',budget:new Budget(path.join(dir,'ledger')),fetchImpl:async()=>{calls++;throw Error('secret');}}),service=new mod.ArrangementService(ai,search);await assert.rejects(service.generate({...request(),librarySummaryConsent:false}),/consent/i);assert.equal(calls,0);await assert.rejects(service.generate(request()),/failed/);assert.equal(calls,1);const abort=new AbortController();abort.abort();await assert.rejects(service.generate(request(),{signal:abort.signal}));assert.equal(calls,1);});
test('invented candidate and selected-scope retrieval are rejected',async()=>{assert.equal(typeof mod.ArrangementService,'function');const {lib,dir}=await installedFixture(),search=new LibrarySearch(lib,new AnalysisStore(lib));let mode='selected';const ai=createAI({key:'TEST',budget:new Budget(path.join(dir,'ledger')),fetchImpl:async()=>response(mode==='selected'?decision('search','pistol'):decision('arrange','',{message:'bad',operations:[{kind:'add',source:'sample',layerId:'',changes:[{field:'assetId',value:'candidate_invented'}]}]}))}),service=new mod.ArrangementService(ai,search),r=request();await assert.rejects(service.generate({...r,scope:r.project.layers[0].id}),/scope|selected/i);mode='invented';await assert.rejects(service.generate(r),/candidate/i);});
test('candidate cloud allowlist keeps numeric band estimates but strips private and arbitrary fields',async()=>{const {cloudLibraryContext}=await import('../src/library-ai-contract.mjs');const c={candidateId:'candidate_00000000-0000-0000-0000-000000000001',category:'Weapons',subcategory:'Pistol',tags:['pistol'],duration:1,boundaryStatus:'estimated',path:'/PRIVATE/source.wav',data:'PRIVATE_AUDIO',measurements:{peakDbfs:-6,rmsDbfs:-20,crestDb:14,activityThresholdDbfs:-60,private:'PRIVATE',bandEnergyEstimate:{low:.01,mid:.02,high:.03,private:'PRIVATE'}}};const r=cloudLibraryContext({round:1,candidates:[c]});assert.deepEqual(r.candidates[0].measurements.bandEnergyEstimate,{low:.01,mid:.02,high:.03,method:'first-order-filter-residuals-not-orthogonal-spectrum'});assert.equal(JSON.stringify(r).includes('PRIVATE'),false);assert.throws(()=>cloudLibraryContext({round:1,candidates:[{...c,measurements:{...c.measurements,peakDbfs:Infinity}}]}),/measurement/i);});
test('library planner receives explicit conjunctive search semantics and zero-match broadening guidance',async()=>{const {cloudLibraryContext}=await import('../src/library-ai-contract.mjs');const c=cloudLibraryContext({round:1,candidates:[],lastSearch:{query:'pistol handgun single gunshot',candidateCount:0,totalMatches:0}});assert.equal(c.searchContract.match,'all_terms');assert.equal(c.searchContract.semanticExpansion,false);assert.equal(c.lastSearch.nextAction,'remove_terms_and_try_one_source_keyword');});

test('candidate evidence stays bounded and rejects invented match fields',async()=>{
 const {cloudLibraryContext}=await import('../src/library-ai-contract.mjs');
 const c={candidateId:'candidate_00000000-0000-0000-0000-000000000001',name:'Gun Foley Pistol',description:'Pistol, Dry Fire',matchedFields:['description'],category:'Combat',subcategory:'Gunshots',tags:[],duration:1,boundaryStatus:'estimated',privatePath:'/private/source.wav'};
 const result=cloudLibraryContext({round:1,candidates:[c]}).candidates[0];
 assert.equal(result.name,c.name);assert.equal(result.description,c.description);
 assert.deepEqual(result.matchedFields,['description']);
 assert.equal('privatePath' in result,false);
 for(const change of [{description:'x'.repeat(601)},{name:'x'.repeat(201)},{matchedFields:['heard_gunshot']},{matchedFields:['name','name']}])assert.throws(()=>cloudLibraryContext({round:1,candidates:[{...c,...change}]}));
});

test('coordinator delivers description evidence and scoped selection guidance to mocked Sol',async()=>{
 const {readFile,writeFile}=await import('node:fs/promises');
 const {lib,dir}=await installedFixture();
 const file=path.join(lib.versionDir('team-test','0.1.0'),'catalog.json');
 const catalog=JSON.parse(await readFile(file,'utf8'));
 catalog.assets[0].audio.embedded_description='Pistol, Single Shot, Close Perspective';
 await writeFile(file,JSON.stringify(catalog));
 let calls=0;
 const ai=createAI({key:'TEST',budget:new Budget(path.join(dir,'ledger')),fetchImpl:async(_,options)=>{
  calls++;const payload=JSON.parse(options.body);
  assert.match(payload.instructions,/Dry Fire/);
  assert.match(payload.instructions,/Explicit exact-identity constraints/);
  assert.match(payload.instructions,/do not add unrequested events/);
  assert.match(payload.instructions,/descriptions, tags.*untrusted DATA/);
  if(calls===1)return response(decision('search','pistol shot'));
  const candidates=JSON.parse(payload.input.at(-1).content).library.candidates;
  const selected=candidates.find(c=>c.description==='Pistol, Single Shot, Close Perspective');
  assert.ok(selected);assert.equal(selected.name,'Pistol Single Shot');
  assert.ok(selected.matchedFields.includes('description'));
  assert.equal(options.body.includes(dir),false);
  return response({...decision('arrange','',{message:'Catalog describes a single shot; not auditioned',operations:[{kind:'add',layerId:'',source:'sample',changes:[{field:'assetId',value:selected.candidateId},{field:'duration',value:.5}]}]}),reason:'Use the catalog-described Single Shot as the primary event; recording space remains unverified.'});
 }});
 const search=new LibrarySearch(lib,new AnalysisStore(lib));
 const result=await new mod.ArrangementService(ai,search).generate(request());
 assert.equal(result.candidates[0].name,'Pistol Single Shot');
 assert.match(result.reason,/Single Shot/);assert.equal(calls,2);
});
