import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProject} from '../src/project.mjs';
import {projectContext} from '../src/ai-contract.mjs';
import * as budgetModule from '../server/budget.mjs';
import * as aiModule from '../server/ai.mjs';
const budget=()=>new budgetModule.Budget(join(mkdtempSync(join(tmpdir(),'soniloom-budget-')),'budget.jsonl'));
const request=()=>({prompt:'Make it softer',scope:'all',project:projectContext(createProject()),history:[]});
test('durable budget reserves before calls, survives restart, stops below $5 and fails closed',()=>{
 assert.equal(typeof budgetModule.Budget,'function');const b=budget();
 for(let i=0;i<25;i++)b.reserve();assert.throws(()=>b.reserve(),/budget/i);
 assert.equal(new budgetModule.Budget(b.path).status().reservedUSD,5);
 writeFileSync(b.path,'corrupted');assert.throws(()=>b.status(),/ledger/i);
});
test('provider receives metadata only and returns validated real-format response with usage',async()=>{
 assert.equal(typeof aiModule.createAI,'function');const b=budget();let body;
 const service=aiModule.createAI({key:'test-only',budget:b,fetchImpl:async(url,options)=>{
  assert.equal(b.status().requests,1);body=JSON.parse(options.body);
  return new Response(JSON.stringify({id:'resp_test',status:'completed',usage:{input_tokens:100,output_tokens:50},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({message:'Try reducing gain',operations:[]})}]}]}));
 }});
 const r=request();r.project.assets=[{id:'a'.repeat(64),name:'tap',data:'PRIVATE_WAV'}];r.project.extra='PRIVATE_KEY';
 const out=await service.generate(r);assert.equal(out.proposal.message,'Try reducing gain');
 assert.equal(JSON.stringify(body).includes('PRIVATE'),false);assert.equal(body.store,false);assert.equal(body.max_output_tokens,4096);
 assert.equal(b.status().estimatedUSD,.0007);assert.equal(out.responseId,'resp_test');
});
test('provider failure never retries, reserves unknown spend and protects secrets',async()=>{
 const b=budget();let calls=0;const s=aiModule.createAI({key:'test-only',budget:b,fetchImpl:async()=>{calls++;throw Error('PRIVATE_PROVIDER_DETAIL');}});
 await assert.rejects(s.generate(request()),e=>!e.message.includes('PRIVATE')&&/failed/i.test(e.message));assert.equal(calls,1);assert.equal(b.status().reservedUSD,.20);
});
test('missing key, invalid scope and invalid context make zero calls',async()=>{
 const b=budget();let calls=0;const s=aiModule.createAI({key:'',budget:b,fetchImpl:()=>{calls++;}});
 await assert.rejects(s.generate(request()),/key/i);
 const withKey=aiModule.createAI({key:'test-only',budget:b,fetchImpl:()=>{calls++;}});
 await assert.rejects(withKey.generate({...request(),scope:'missing'}),/scope/i);
 assert.equal(calls,0);assert.equal(b.status().requests,0);
});
test('incomplete or malformed responses never become proposals and missing usage retains reserve',async()=>{
 for(const response of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'not json'}]}]}]){
  const b=budget(),s=aiModule.createAI({key:'test-only',budget:b,fetchImpl:async()=>new Response(JSON.stringify(response))});
  await assert.rejects(s.generate(request()),/incomplete|invalid/i);assert.equal(b.status().unsettled,1);
 }
});
test('concurrent requests cannot silently spend twice',async()=>{
 let release;const b=budget(),s=aiModule.createAI({key:'test-only',budget:b,fetchImpl:()=>new Promise(resolve=>release=resolve)});
 const pending=s.generate(request());await assert.rejects(s.generate(request()),/running/);
 release(new Response('{}',{status:429}));await assert.rejects(pending,/429/);assert.equal(b.status().requests,1);
});
test('Sol configuration validates effort before spending and forwards selected effort',async()=>{const b=budget();let sent;const s=aiModule.createAI({key:'test',budget:b,fetchImpl:async(_,o)=>{sent=JSON.parse(o.body);return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"message":"OK","operations":[]}'}]}]}));}});await assert.rejects(s.generate({...request(),reasoningEffort:'arbitrary'}),/reasoning/i);assert.equal(b.status().requests,0);await s.generate({...request(),reasoningEffort:'high'});assert.equal(sent.model,'gpt-6.1-sol');assert.equal(sent.reasoning.effort,'high');assert.equal(aiModule.normalizeRequest(request()).reasoningEffort,'medium');});
test('mixed legacy and Sol reservations preserve history and cumulative cap',()=>{const b=budget();const original=JSON.stringify({type:'reserve',id:'legacy',cents:15,model:'gpt-5.4-mini-2026-03-17'})+'\n'+JSON.stringify({type:'usage',id:'legacy',usd:.01})+'\n';writeFileSync(b.path,original);for(let i=0;i<24;i++)b.reserve();assert.equal(b.status().reservedUSD,4.95);assert.throws(()=>b.reserve(),/budget/);assert.ok(readFileSync(b.path,'utf8').startsWith(original));const c=budget();writeFileSync(c.path,JSON.stringify({type:'reserve',id:'bad',cents:1,model:'gpt-6.1-sol'}));assert.throws(()=>c.status(),/ledger/);});
