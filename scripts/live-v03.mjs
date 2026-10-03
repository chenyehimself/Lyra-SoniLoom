import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ProjectStore,serializeProject} from '../src/project.mjs';
import {projectContext,prepareProposal,applyProposal} from '../src/ai-contract.mjs';
import {renderProject} from '../src/engine.mjs';
import {encodeWav} from '../src/wav.mjs';
const origin='http://127.0.0.1:8796',root=new URL('../outputs/v0.3/',import.meta.url);
const store=new ProjectStore(JSON.parse(readFileSync(new URL('garage-room.soniloom.json',root))));
const id=store.project.layers[0].id,protectedId=store.project.layers[1].id;store.lock(protectedId,true);
const base=renderProject(store.project),history=[],evidence=[];
const status=await(await fetch(origin+'/api/status')).json();if(!status.configured)throw Error('No configured key');
for(const [prompt,field,value]of [
 ['只修改选中的枪口爆裂声层：早期反射强度改为0.28。保持干声、声源、时间、音量以及其余空间参数完全不变。','roomEarly',.28],
 ['继续修改同一声层，只把混响尾音衰减时间改成0.65秒，保留上次的反射强度和所有其他参数。','roomDecay',.65],
 ['继续修改同一声层，只把混响尾音强度改成0.18，保留之前两次修改以及其他所有参数。','roomLate',.18]
]){
 const response=await fetch(origin+'/api/propose',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-SoniLoom-Token':status.clientToken},body:JSON.stringify({prompt,scope:id,project:projectContext(store.project),history})});const data=await response.json();if(!response.ok)throw Error(data.error);
 const plan=prepareProposal(store,data.proposal,{scope:id});evidence.push({prompt,...data,changes:plan.changes});writeFileSync(new URL('provider-evidence.json',root),JSON.stringify(evidence,null,2));
 assert.equal(plan.changes.length,1);assert.equal(plan.changes[0].field,field);applyProposal(store,plan);assert.equal(store.project.layers[0][field],value);
 const r=renderProject(store.project);assert.deepEqual(r.stems.dry,base.stems.dry);assert.deepEqual(r.layers[protectedId],base.layers[protectedId]);assert.equal(r.clipped,0);
 history.push({role:'user',content:prompt},{role:'assistant',content:data.proposal.message+' [Applied]'});
 console.log(JSON.stringify({field,value,responseId:data.responseId,budget:data.budget}));
}
writeFileSync(new URL('garage-ai-refined.soniloom.json',root),serializeProject(store.project));writeFileSync(new URL('garage-ai-refined.wav',root),new Uint8Array(encodeWav(renderProject(store.project).channels)));
console.log('PASS three provider room edits, same source IDs, exact protected/dry PCM');
