import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createProject} from '../src/project.mjs';
import {createAgentContext} from '../src/agent-context.mjs';
import {createAgentRuntime} from '../server/agent-runtime.mjs';
import {ROLE_MODELS} from '../server/model-policy.mjs';
import {Budget} from '../server/budget.mjs';
const policies=Object.fromEntries(Object.entries(ROLE_MODELS).map(([role,model])=>[role,{role,model,verified:true,source:'mock test only',reserveCents:20,prices:{input:1,output:2}}]));
const response=decision=>new Response(JSON.stringify({status:'completed',usage:{input_tokens:10,output_tokens:10},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(decision)}]}]}));
test('full runtime retains clarification history and routes the answer through both role providers',async()=>{
 const project=createProject(),memory=createAgentContext({sessionId:'s',projectId:project.id}),budget=new Budget(join(mkdtempSync(join(tmpdir(),'agent-runtime-')),'ledger'));
 let prompts=0,sol=0;
 const runtime=createAgentRuntime({key:'TEST',budget,policies,search:null,fetchImpl:async(_,o)=>{
  const payload=JSON.parse(o.body),input=JSON.parse(payload.input.at(-1).content);
  if(payload.model===ROLE_MODELS.luna){assert.match(payload.instructions,/Intent understanding/);assert.doesNotMatch(payload.instructions,/Engine and editing/);prompts++;assert.equal(input.context.turns.length,prompts-1);const ask=prompts<=8;return response({status:ask?'needs_clarification':'ready',intentKind:'revise_sound',requestedOutcome:'Lower gain',targetLayerIds:ask?[]:[project.layers[0].id],preserve:[],evidenceTurnIds:input.context.turns.map(t=>t.id),unknowns:[],assumptions:[],question:ask?'Which source?':''});}
  assert.match(payload.instructions,/Sound design planning/);assert.match(payload.instructions,/Evidence and analysis/);assert.match(payload.instructions,/Engine and editing/);sol++;assert.equal(input.agent.intentRecord.originalText,'First source');assert.equal(input.agent.context.turns.length,8);assert.equal(input.agent.remaining.sol,2);
  return response({action:'arrange',query:'',reason:'User identified the source',proposal:{message:'Lower gain',operations:[{kind:'edit',layerId:project.layers[0].id,source:'',changes:[{field:'gain',value:.1}]}]}});
 }});
 for(let i=0;i<9;i++){
  const context=memory.snapshot({project,generation:0,scope:'all',selectedLayerId:null});
  const out=await runtime.run({requestId:`r${i}`,prompt:i===8?'First source':'Make that softer',context,librarySummaryConsent:false});
  assert.equal(out.kind,i===8?'proposal':'clarification');
  if(i<8){assert.equal(sol,0);memory.recordTurn({id:`r${i}`,anchor:context.anchor,userText:'Make that softer',assistantText:out.message,outcome:'clarification',evidenceTurnIds:out.intentRecord.decision.evidenceTurnIds,preserveEvidenceTurnIds:[]});}
 }
 assert.equal(prompts,9);assert.equal(sol,1);assert.equal(budget.status().requests,10);
});

test('scripted room-only revision loads skills and preserves source fields through Apply/Undo',async()=>{
 const {ProjectStore}=await import('../src/project.mjs');
 const {prepareProposal,applyProposal}=await import('../src/ai-contract.mjs');
 const project=createProject(),store=new ProjectStore(project),memory=createAgentContext({sessionId:'room',projectId:project.id});
 const context=memory.snapshot({project,generation:0,scope:project.layers[0].id,selectedLayerId:project.layers[0].id});
 const budget=new Budget(join(mkdtempSync(join(tmpdir(),'room-skill-')),'ledger'));let calls=0;
 const runtime=createAgentRuntime({key:'TEST',budget,policies,search:{begin(){throw Error('Room-only edits must not search');}},fetchImpl:async(_,options)=>{
  calls++;const payload=JSON.parse(options.body);
  if(payload.model===ROLE_MODELS.luna){assert.match(payload.instructions,/Smaller room, same shot/);return response({status:'ready',intentKind:'revise_sound',requestedOutcome:'Smaller room, preserve the source',targetLayerIds:[project.layers[0].id],preserve:[],evidenceTurnIds:[],unknowns:[],assumptions:[],question:''});}
  assert.match(payload.instructions,/Room-only requests MUST change only these room fields/);
  return response({action:'arrange',query:'',reason:'Supported room spacing adjustment; not auditioned',proposal:{message:'Reduce room spacing',operations:[{kind:'edit',layerId:project.layers[0].id,source:'',changes:[{field:'roomSize',value:4}]}]}});
 }});
 const out=await runtime.run({requestId:'room-1',prompt:'Smaller room, same source',context,librarySummaryConsent:false});
 assert.deepEqual(out.calls,{luna:1,sol:1,search:0});assert.equal(calls,2);
 const prepared=prepareProposal(store,out.proposal,{scope:context.scope});assert.deepEqual(prepared.changes.map(c=>c.field),['roomSize']);
 applyProposal(store,prepared);assert.deepEqual(store.project.layers[0],{...project.layers[0],roomSize:4});assert.deepEqual(store.project.layers.slice(1),project.layers.slice(1));
 store.undo();assert.deepEqual(store.project,project);
});
