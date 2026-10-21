import {skillInstructions} from './skills.mjs';
import {LIBRARY_DECISION_SCHEMA,validateDecision,cloudLibraryContext,PROFESSIONAL_DECISION_SCHEMA,validateProfessionalDecision} from '../src/library-ai-contract.mjs';
import {ENGINE,LEGACY_ENGINE,validateProject} from '../src/project.mjs';
import {PROPOSAL_SCHEMA,projectContext,validateProposal} from '../src/ai-contract.mjs';
import {SAMPLE_FIELDS,sourceWindow,validateAudioMetadata} from '../src/sample.mjs';
import {MODEL} from './budget.mjs';

const instructions=skillInstructions('sol');

export function normalizeRequest(raw){
 if(!raw||typeof raw.prompt!=='string'||!raw.prompt.trim()||raw.prompt.length>3000)throw Error('Prompt must contain 1–3000 characters');
 const p=raw.project;if(!p||!Array.isArray(p.layers)||p.layers.length>16||!Array.isArray(p.assets)||p.assets.length>16)throw Error('Invalid project context');
 const assets={};for(const a of p.assets){if(!a||!/^([a-f0-9]{64})$/.test(a.id)||typeof a.name!=='string'||a.name.length>200)throw Error('Invalid source metadata');assets[a.id]={name:a.name,...(a.audio?{audio:validateAudioMetadata(a.audio)}:{})};}
 const project=projectContext({...p,schemaVersion:p.schemaVersion??1,engine:p.engine??LEGACY_ENGINE,assets});
 for(const l of project.layers){if(l.type==='sample'&&!Object.hasOwn(assets,l.assetId))throw Error('Missing source metadata');if(SAMPLE_FIELDS.some(k=>Object.hasOwn(l,k))){if(project.schemaVersion<3||l.type!=='sample')throw Error('Source selection requires sample editing upgrade');const a=assets[l.assetId]?.audio;if(!a)throw Error('Source measurements required for selection');sourceWindow(l,a.frames,a.sampleRate);}}
 validateProject({...project,schemaVersion:p.schemaVersion??1,engine:p.engine??LEGACY_ENGINE,assets:{},layers:project.layers.map(l=>l.type==='sample'?{...Object.fromEntries(Object.entries(l).filter(([k])=>!SAMPLE_FIELDS.includes(k))),type:'tone',assetId:null}:l)});
 const scope=raw.scope;if(scope!=='all'&&!project.layers.some(l=>l.id===scope))throw Error('Invalid edit scope');
 if(!Array.isArray(raw.history)||raw.history.length>12)throw Error('Invalid conversation history');
 const history=raw.history.map(m=>{if(!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>6000)throw Error('Invalid conversation message');return {role:m.role,content:m.content};});
 const reasoningEffort=raw.reasoningEffort??'medium';if(!['low','medium','high'].includes(reasoningEffort))throw Error('Invalid reasoning effort');
 return {prompt:raw.prompt.trim(),project,scope,history,reasoningEffort};
}
export function createAI({key,budget,fetchImpl=fetch,timeoutMs=60000,roleProvider=null}){
 let busy=false;
 return {
  status(){return {configured:!!key,model:MODEL,reasoningEfforts:['low','medium','high'],defaultReasoningEffort:'medium',busy,budget:budget.status()};},
  async generate(raw,{libraryContext=null,professionalContext=null,signal}={}){
   signal?.throwIfAborted();
   if(!key)throw Error('OPENAI_API_KEY is not configured on the local server');
   const request=normalizeRequest(raw);if(busy)throw Error('Another AI request is running. Try again after it finishes.');
   const library=libraryContext?cloudLibraryContext(libraryContext):null;
   const routeInstructions=professionalContext
    ? '\nCOORDINATED MODE: Return action/query/reason/proposal using the supplied schema. At most three Sol calls and at most two searches per submission. remaining.sol counts calls LEFT AFTER this response: when zero, search is forbidden; finish with arrange, clarify or unavailable. A discussion has zero operations. Search requires librarySummaryConsent and whole-sound scope.'
    : library
     ? '\nLEGACY LIBRARY MODE: Return action/query/reason/proposal. Actions are search, arrange, unavailable. Use at most four Sol calls and three searches; when round=3, arrange or unavailable only. For ambiguity return unavailable with a concrete question and zero operations.'
     : '\nLEGACY DIRECT MODE: Return message and operations only. No library search is available. Ask a concrete question with operations: [] if ambiguous or unsupported.';
   const payload={model:MODEL,store:false,reasoning:{effort:request.reasoningEffort},max_output_tokens:4096,instructions:instructions+routeInstructions,
    input:[...request.history,{role:'user',content:JSON.stringify({request:request.prompt,scope:request.scope,currentProject:request.project,...(library?{library}:{}),...(professionalContext?{agent:professionalContext}:{})})}],
    text:{format:{type:'json_schema',name:professionalContext?'professional_decision':library?'library_decision':'sound_proposal',strict:true,schema:professionalContext?PROFESSIONAL_DECISION_SCHEMA:library?LIBRARY_DECISION_SCHEMA:PROPOSAL_SCHEMA}}};
   const body=JSON.stringify(payload);if(Buffer.byteLength(body)>64*1024)throw Error('Conversation context too large. Start a fresh conversation.');
   busy=true;
   try{
    if(professionalContext){if(!roleProvider)throw Error('Role provider required');const out=await roleProvider.invoke('sol',payload,{signal});validateProfessionalDecision(out.decision);return {decision:out.decision,...out.providerMeta,reasoningEffort:request.reasoningEffort};}
    const reservation=budget.reserve();let response;
    try{response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)});}
    catch{throw Error('AI request failed or timed out. Sound unchanged; no automatic retry. Budget reservation retained.');}
    if(!response.ok)throw Error(`OpenAI returned HTTP ${response.status}. Sound unchanged; check project access or billing. No automatic retry.`);
    let data;try{data=await response.json();}catch{throw Error('Invalid provider response; sound unchanged');}
    const responseId=typeof data.id==='string'?data.id.slice(0,100):null;
    budget.settle(reservation,data.usage,responseId);
    if(data.status!=='completed')throw Error('AI response incomplete. Sound unchanged; try a narrower request.');
    const content=(data.output||[]).flatMap(o=>o.type==='message'&&Array.isArray(o.content)?o.content:[]);
    if(content.some(c=>c.type==='refusal'))throw Error('The provider declined this request. Sound unchanged.');
    let proposal;try{proposal=JSON.parse(content.filter(c=>c.type==='output_text').map(c=>c.text).join(''));if(library)validateDecision(proposal);else validateProposal(proposal);}catch{throw Error('AI returned an invalid edit proposal. Sound unchanged.');}
    return {...(library?{decision:proposal}:{proposal}),model:MODEL,reasoningEffort:request.reasoningEffort,responseId,usage:data.usage?{input_tokens:data.usage.input_tokens,output_tokens:data.usage.output_tokens}:null,budget:budget.status()};
   }finally{busy=false;}
  }
 };
}
