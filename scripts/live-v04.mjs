import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ProjectStore,serializeProject} from '../src/project.mjs';
import {projectContext,prepareProposal,applyProposal} from '../src/ai-contract.mjs';
import {renderProject} from '../src/engine.mjs';
import {encodeWav} from '../src/wav.mjs';
const origin='http://127.0.0.1:8797',root=new URL('../outputs/v0.4/',import.meta.url);
const store=new ProjectStore(JSON.parse(readFileSync(new URL('source-before.soniloom.json',root))));
const id=store.project.layers[0].id,protectedId=store.project.layers[1].id;store.lock(protectedId,true);
const originalAssets=structuredClone(store.project.assets);const base=renderProject(store.project),history=[],evidence=[];
const status=await(await fetch(origin+'/api/status')).json();if(!status.configured)throw Error('No configured key');
for(const [prompt,field,value]of [
 ['只修改选中录音层的 sourceIn 为0.23秒。sourceOut保持1.5秒，所有其他字段不变。','sourceIn',.23],
 ['继续同一层，只把 sourceOut 改为0.85秒，保留sourceIn和其他全部参数。','sourceOut',.85],
 ['继续同一层，只把淡出 release 改为0.18秒，保持之前的选区及所有其他参数。','release',.18]
]){
 const response=await fetch(origin+'/api/propose',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-SoniLoom-Token':status.clientToken},body:JSON.stringify({prompt,scope:id,project:projectContext(store.project),history})});const data=await response.json();if(!response.ok)throw Error(data.error);
 const plan=prepareProposal(store,data.proposal,{scope:id});evidence.push({prompt,...data,changes:plan.changes});writeFileSync(new URL('provider-evidence.json',root),JSON.stringify(evidence,null,2));
 assert.equal(plan.changes.length,1);assert.equal(plan.changes[0].field,field);applyProposal(store,plan);assert.equal(store.project.layers[0][field],value);
 const r=renderProject(store.project);assert.deepEqual(store.project.assets,originalAssets);assert.deepEqual(r.layers[protectedId],base.layers[protectedId]);assert.equal(r.clipped,0);
 history.push({role:'user',content:prompt},{role:'assistant',content:data.proposal.message+' [Applied]'});
 console.log(JSON.stringify({field,value,responseId:data.responseId,budget:data.budget}));
}
writeFileSync(new URL('source-ai-refined.soniloom.json',root),serializeProject(store.project));writeFileSync(new URL('source-ai-refined.wav',root),new Uint8Array(encodeWav(renderProject(store.project).channels)));
console.log('PASS three provider sample edits, unchanged original bytes and protected PCM');
