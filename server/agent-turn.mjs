import {validateIntentContext,makeIntentRecord} from '../src/intent-contract.mjs';
import {validateProfessionalDecision} from '../src/library-ai-contract.mjs';

/** One user submission. Waiting for a reply never polls a provider. */
export class AgentTurnService {
 constructor({intent,professional,search}){Object.assign(this,{intent,professional,search});this.busy=false;this.seen=new Set();}
 async run(raw,{signal}={}){
  signal?.throwIfAborted();
  const context=validateIntentContext(raw?.context);
  if(typeof raw.requestId!=='string'||!raw.requestId.trim()||raw.requestId.length>200||typeof raw.prompt!=='string'||!raw.prompt.trim()||raw.prompt.length>3000)throw Error('Invalid agent request');
  const effort=raw.reasoningEffort??'medium';if(!['low','medium','high'].includes(effort))throw Error('Invalid reasoning effort');
  if(this.busy)throw Error('Another agent request is running');
  const key=JSON.stringify([context.anchor.sessionId,raw.requestId]);
  if(this.seen.has(key))throw Error('Request already attempted; send a new user message');
  if(this.seen.size>=10000)throw Error('Request history capacity reached; restart the local server');
  this.seen.add(key);this.busy=true;
  const calls={luna:0,sol:0,search:0},usage=[];let session=null,intentRecord=null,lastSearch=null;
  const fresh=()=>{signal?.throwIfAborted();if(JSON.stringify(raw.context.anchor)!==JSON.stringify(context.anchor))throw Error('Project context changed during request');};
  const result=(kind,message,extra={})=>({kind,message,requestId:raw.requestId,anchor:context.anchor,intentRecord,calls:{...calls},usage:[...usage],...extra});
  const understand=async professionalQuestion=>{
   fresh();if(calls.luna>=3)throw Error('Luna call limit reached');calls.luna++;
   const out=await this.intent.interpret({requestId:raw.requestId,prompt:raw.prompt,context,professionalQuestion},{signal});fresh();
   if(out.providerMeta)usage.push({role:'luna',...out.providerMeta});
   return makeIntentRecord({requestId:raw.requestId,originalText:raw.prompt,context,decision:out.decision});
  };
  try{
   intentRecord=await understand();
   if(intentRecord.decision.status==='needs_clarification')return result('clarification',intentRecord.decision.question);
   if(intentRecord.decision.intentKind==='cancel')return result('cancelled','Cancelled · Sound unchanged');
   while(calls.sol<3){
    fresh();if(session)await this.search.session(session.id);calls.sol++;
    const out=await this.professional.decide({intentRecord:structuredClone(intentRecord),context:structuredClone(context),candidates:session?this.search.summaries(session.id):[],round:calls.search,lastSearch,librarySummaryConsent:raw.librarySummaryConsent===true,reasoningEffort:effort,remaining:{luna:3-calls.luna,sol:3-calls.sol,search:3-calls.search}},{signal});fresh();
    if(out.usage||out.model)usage.push({role:'sol',model:out.model,usage:out.usage??null});
    const d=validateProfessionalDecision(out.decision);
    const nonEdit=['discuss','clarify'].includes(intentRecord.decision.intentKind);
    if(nonEdit&&d.proposal.operations.length)throw Error('A non-edit intent cannot mutate the project');
    if(d.action==='search'){
     if(nonEdit||context.scope!=='all'||raw.librarySummaryConsent!==true)throw Error('Intent, scope or consent does not permit library search');
     if(calls.sol>=3||calls.search>=3)return result('unavailable','Search limit reached without a final plan. Sound unchanged.');
     session??=await this.search.begin();calls.search++;
     const found=await this.search.search(session.id,d.query,{signal});lastSearch={query:d.query,totalMatches:found.totalMatches,candidateCount:found.candidates.length};fresh();continue;
    }
    if(d.action==='clarify'){
     const phrased=await understand(d.proposal.message||d.reason);
     return result('clarification',phrased.decision.status==='needs_clarification'?phrased.decision.question:(d.proposal.message||d.reason));
    }
    const layers=context.projectFacts.layers,targets=new Set(intentRecord.decision.targetLayerIds);
    for(const op of d.proposal.operations){
     if(intentRecord.decision.intentKind==='revise_sound'&&!['edit','remove'].includes(op.kind))throw Error('Proposal exceeds intent targets; structural changes need explicit new-sound scope');
     if(context.scope!=='all'&&(op.kind!=='edit'||op.layerId!==context.scope))throw Error('Proposal exceeds selected scope');
     if(['edit','remove'].includes(op.kind)){
      const layer=layers.find(l=>l.id===op.layerId);
      if(!layer||layer.locked)throw Error('Unknown or locked layer');
      if(intentRecord.decision.intentKind==='revise_sound'&&!targets.has(op.layerId))throw Error('Proposal exceeds intent targets');
     }
     if(op.kind==='project'&&op.changes.some(c=>c.field==='duration')&&layers.some(l=>l.locked))throw Error('Locked layers prevent length changes');
    }
    const ids=[...new Set(d.proposal.operations.filter(o=>o.kind==='add'&&o.source==='sample').map(o=>o.changes.find(c=>c.field==='assetId')?.value).filter(v=>typeof v==='string'&&v.startsWith('candidate_')))];
    if(ids.length&&!session)throw Error('Unknown candidate');
    const candidates=session?await this.search.details(session.id,ids):[];
    const state=session?await this.search.session(session.id):null;fresh();
    const kind=d.action==='unavailable'?'unavailable':nonEdit||d.action==='discussion'?'discussion':'proposal';
    return result(kind,d.proposal.message,{proposal:d.proposal,reason:d.reason,candidates,trace:state?.trace??[],sessionId:session?.id??null});
   }
  }finally{this.busy=false;}
 }
}
