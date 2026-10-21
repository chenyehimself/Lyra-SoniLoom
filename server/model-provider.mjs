import {validateModelPolicy,ROLE_MODELS} from './model-policy.mjs';
export function createRoleProvider({key,budget,policies={},fetchImpl=fetch,timeoutMs=60000}){
 let busy=false;
 const policy=role=>validateModelPolicy(policies[role],role);
 return {
  status(){let policyReady=true;try{policy('luna');policy('sol');}catch{policyReady=false;}return {configured:!!key&&policyReady,policyReady,models:ROLE_MODELS,disabledReason:!policyReady?'Verified Luna/Sol billing policies are not configured':!key?'API key missing':null};},
  async invoke(role,payload,{signal}={}){
   signal?.throwIfAborted();const billing=policy(role);
   if(!key)throw Error('API key missing');if(busy)throw Error('Another model request is running');
   const body=JSON.stringify({...payload,model:billing.model,store:false});
   if(Buffer.byteLength(body)>64*1024)throw Error('Model payload exceeds 64 KiB; no request sent');
   busy=true;
   try{
    const reservation=budget.reserve(billing);let response;
    try{response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)});}catch{throw Error('Model request failed or cancelled; no retry; budget reservation retained');}
    if(!response.ok)throw Error(`Model returned HTTP ${response.status}; no retry`);
    let data;try{data=await response.json();}catch{throw Error('Invalid model response');}
    budget.settle(reservation,data.usage,typeof data.id==='string'?data.id.slice(0,100):null);signal?.throwIfAborted();
    if(data.status!=='completed')throw Error('Incomplete model response');
    const content=(data.output||[]).flatMap(o=>o.type==='message'&&Array.isArray(o.content)?o.content:[]);
    if(content.some(c=>c.type==='refusal'))throw Error('Model declined the request');
    let decision;try{decision=JSON.parse(content.filter(c=>c.type==='output_text').map(c=>c.text).join(''));}catch{throw Error('Invalid model output');}
    return {decision,providerMeta:{model:billing.model,usage:data.usage?{input_tokens:data.usage.input_tokens,output_tokens:data.usage.output_tokens}:null}};
   }finally{busy=false;}
  }
 };
}
