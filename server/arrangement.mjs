import {normalizeRequest} from './ai.mjs';
/** Coordinates at most 3 searches and 4 model calls. No fallback or retries. */
export class ArrangementService{
 constructor(ai,search){this.ai=ai;this.search=search;this.busy=false;}
 async generate(raw,{signal}={}){
  signal?.throwIfAborted();if(raw.librarySummaryConsent!==true)throw Error('Library summary consent is required');const request=normalizeRequest(raw);if(this.busy)throw Error('A library arrangement is already running');this.busy=true;
  try{const session=await this.search.begin();let round=0,lastSearch=null;for(let call=0;call<4;call++){
   signal?.throwIfAborted();await this.search.session(session.id);
   const out=await this.ai.generate(request,{signal,libraryContext:{round,candidates:this.search.summaries(session.id),lastSearch}}),d=out.decision;signal?.throwIfAborted();
   if(d.action==='search'){if(request.scope!=='all')throw Error('Selected scope cannot search or add library assets');if(round>=3)throw Error('Maximum three retrieval rounds reached; narrow the request or choose a candidate');const found=await this.search.search(session.id,d.query,{signal});round=found.round;lastSearch={query:d.query,candidateCount:found.candidates.length,totalMatches:found.totalMatches};continue;}
   const ids=[...new Set(d.proposal.operations.filter(op=>op.kind==='add'&&op.source==='sample').map(op=>op.changes.find(c=>c.field==='assetId')?.value).filter(id=>typeof id==='string'&&id.startsWith('candidate_')))];const candidates=await this.search.details(session.id,ids),state=await this.search.session(session.id);
   return {proposal:d.proposal,reason:d.reason,unavailable:d.action==='unavailable',sessionId:session.id,candidates,trace:state.trace,model:out.model,reasoningEffort:out.reasoningEffort,usage:out.usage,budget:out.budget,calls:call+1};
  }throw Error('Maximum three retrieval rounds reached');}finally{this.busy=false;}
 }
}
