import {createAgentContext} from './agent-context.mjs';
import {prepareArrangement,previewProject} from './arrangement.mjs';
import {encodeWav} from './wav.mjs';
import {shouldSend} from './shortcuts.mjs';
import {prepareProposal,applyProposal} from './ai-contract.mjs';
const $=id=>document.getElementById(id);
const node=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const value=x=>x===null?'—':typeof x==='object'?JSON.stringify(x):String(x);

export function createConversation({getStore,getSelected,onApply,onRender,onListen,settings,isMac}){
 let turns=[],busy=false,session=0,status=null,controller=null;
 let memory=null,memoryProject=null,memorySession=crypto.randomUUID();
 function contextFor(owner,scope){
  if(!memory||memoryProject!==owner.project.id){memoryProject=owner.project.id;memory=createAgentContext({sessionId:memorySession,projectId:memoryProject});}
  return memory.snapshot({project:owner.project,generation:owner.generation,scope,selectedLayerId:getSelected()??null});
 }
 function remember(t,outcome){
  if(!t.anchor||t.anchor.sessionId!==memorySession||t.anchor.projectId!==memoryProject)return;
  memory.recordTurn({id:t.id,anchor:t.anchor,userText:t.prompt,assistantText:t.message||'',outcome,evidenceTurnIds:t.intentRecord?.decision.evidenceTurnIds??[],preserveEvidenceTurnIds:[...new Set((t.intentRecord?.decision.preserve??[]).flatMap(p=>p.evidenceTurnIds))]});
 }
 function resetMemory(){memory=null;memoryProject=null;memorySession=crypto.randomUUID();}
 const ready=()=>status?.agent?.configured===true;

 function release(t){t.previewBytes=null;if(t.audioUrl){for(const a of document.querySelectorAll('audio'))if(a.src===t.audioUrl)a.pause();URL.revokeObjectURL(t.audioUrl);t.audioUrl=null;}t.prepared=null;}
 async function finishPreview(turn,prepared){
  const candidate=previewProject(turn.owner,prepared),result=await onRender(candidate);
  if(turn.session!==session)throw Error('Preparation cancelled or library context changed');
  if(turn.owner!==getStore()||turn.generation!==turn.owner.generation)throw Error('Sound changed during preview; prepare again');
  if(!Number.isFinite(result.peak)||result.channels.some(c=>c.some(x=>!Number.isFinite(x))))throw Error('Preview contains invalid audio');
  if(result.clipped)throw Error('Preview clips. No changes applied; request lower levels.');
  turn.previewBytes=encodeWav(result.channels);turn.needsUpgrade=candidate.schemaVersion>turn.owner.project.schemaVersion;turn.prepared=prepared;turn.changes=prepared.changes;turn.state='Ready to review · Sound unchanged';
 }
 function attachAudio(turn){if(turn.previewBytes&&!turn.audioUrl){turn.audioUrl=URL.createObjectURL(new Blob([turn.previewBytes],{type:'audio/wav'}));turn.previewBytes=null;}}

 async function refreshStatus(){
  try{const res=await fetch('/api/status');const data=await res.json();if(!res.ok)throw Error(data.error);status=data;
   $('provider-state').textContent=data.agent?.configured?'Luna → Sol · configured':data.agent?.disabledReason||'Agent unavailable';
   $('provider-state').title='Luna understands intent; Sol plans edits. Configuration is not proof of model access.';
   $('ai-budget').textContent=`$${data.budget.estimatedUSD.toFixed(4)} estimated · $${data.budget.remainingUSD.toFixed(2)} test allowance`;
  }catch{status=null;$('provider-state').textContent='AI unavailable';$('ai-budget').textContent='Local AI service could not be reached';}
  settings.updateStatus(status);$('send-prompt').disabled=busy||!ready();
 }
 function invalidate(){
  const s=getStore();if(busy&&turns.at(-1)?.owner&&(turns.at(-1).owner!==s||turns.at(-1).generation!==s.generation))controller?.abort();for(const t of turns)if(t.prepared&&(t.owner!==s||t.generation!==s.generation)){release(t);t.state='Outdated — sound changed. Send a new request.';remember(t,'outdated');}
 }
 function draw(){
  invalidate();const list=$('chat-messages');list.replaceChildren();
  if(!turns.length){const welcome=node('div','chat-welcome');welcome.append(node('span','eyebrow','YOUR SOUND, IN WORDS'),node('h3','','What would you like to hear?'),node('p','','Describe a sound, then refine its layers. Every AI change stays editable.'));list.append(welcome);
   for(const text of ['Create a short, three-layer spaceship startup.','Make the current sound darker and less harsh.']){const b=node('button','prompt-starter',text);b.onclick=()=>{$('prompt').value=text;$('prompt').focus();};list.append(b);}
  }
  for(const t of turns){const article=node('article','chat-turn'),user=node('div','user-turn'),speaker=node('div','speaker-label','You');const time=node('time','',t.at.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));time.dateTime=t.at.toISOString();speaker.append(time);user.append(speaker,node('div','user-message',t.prompt));article.append(user);
   if(t.message&&!t.error){article.append(node('div','assistant-label','∿  SoniLoom'),node('p','assistant-message',t.message));}
   if(t.evidence?.length){const evidence=node('details','proposal-details');evidence.append(node('summary','',`${t.evidence.length} library selections · catalog tags + local measurements`));for(const c of t.evidence)evidence.append(node('p','',`${c.name} · ${c.firstFrame}–${c.endFrame} source frames · ${c.evidence||'bundle tags'} · ${c.boundaryStatus||'estimated range'}`));article.append(evidence);}
   if(t.trace?.length){const trace=node('details','proposal-details');trace.append(node('summary','',`${t.trace.length}/3 retrieval rounds`));for(const r of t.trace)trace.append(node('p','',`${r.round}. ${r.query} · ${r.totalMatches} tag matches · ${r.candidateCount} intervals${r.warnings?.length?' · '+r.warnings.join('; '):''}`));article.append(trace);}
   if(t.changes?.length){const details=node('details','proposal-details');const summary=node('summary','',`${t.changes.length} changes · ${t.scopeName}`);details.append(summary);
    const ul=node('ul','change-list');for(const c of t.changes){const li=node('li');li.append(node('strong','',`${c.target} · ${c.field}`),node('span','',`${value(c.before)} → ${value(c.after)}`));ul.append(li);}details.append(ul);article.append(details);
   }
   const state=node('p','turn-state',t.state||'');if(t.error)state.classList.add('error');article.append(state);
   if(t.prepared&&t.changes.length){attachAudio(t);if(t.audioUrl){const audio=node('audio','proposal-audio');audio.controls=true;audio.src=t.audioUrl;audio.setAttribute('aria-label','Detached proposal preview');audio.onplay=()=>{onListen?.();for(const other of document.querySelectorAll('audio'))if(other!==audio)other.pause();};article.append(audio);}
const actions=node('div','proposal-actions');const apply=node('button','primary','Apply changes'),dismiss=node('button','','Discard');
    if(t.needsUpgrade){const label=node('label','library-consent'),check=node('input');check.type='checkbox';check.checked=!!t.upgradeAccepted;apply.disabled=!check.checked;check.onchange=()=>{t.upgradeAccepted=check.checked;apply.disabled=!check.checked;};label.append(check,document.createTextNode('Allow schema 4 library sources. Undo restores the previous format.'));article.append(label);}
    apply.onclick=()=>{try{applyProposal(getStore(),t.prepared);release(t);t.state='Applied · Undo is available';remember(t,'applied');onApply();draw();}catch(e){t.prepared=null;t.error=true;t.state=e.message;draw();}};
    dismiss.onclick=()=>{release(t);t.state='Discarded · Sound unchanged';remember(t,'discarded');draw();};actions.append(apply,dismiss);article.append(actions);
   }
   if(t.meta)article.append(node('small','turn-meta',t.meta));list.append(article);
  }
  if(busy)list.append(node('p','thinking','Designing your sound…'));
  $('send-prompt').disabled=busy||!ready();$('prompt').disabled=busy;$('cancel-prompt').hidden=!busy;
 }
 function sync(){invalidate();draw();const id=getSelected(),layer=getStore().project.layers.find(l=>l.id===id);$('selected-scope').disabled=!layer;$('selected-scope').textContent=layer?`Selected layer: ${layer.name}`:'Selected layer';if(!layer&&$('ai-scope').value==='selected')$('ai-scope').value='all';}
 async function submit(event){
  event.preventDefault();const prompt=$('prompt').value.trim();if(!prompt||busy)return;
  if(!ready()){await refreshStatus();if(!ready())return;}
  const owner=getStore(),generation=owner.generation,project=owner.project,scope=$('ai-scope').value==='selected'?getSelected():'all';
  let intentContext;try{intentContext=contextFor(owner,scope);}catch(e){$('provider-state').textContent=e.message;return;}
  for(const t of turns)if(t.prepared){release(t);t.state='Superseded · Not applied';remember(t,'discarded');}
  const turn={id:crypto.randomUUID(),anchor:intentContext.anchor,prompt,session,at:new Date(),owner,generation,scopeName:scope==='all'?'Whole sound':project.layers.find(l=>l.id===scope)?.name||'Selected layer',state:'Waiting for OpenAI'};turns.push(turn);busy=true;controller=new AbortController();const thisSession=session;$('prompt').value='';draw();
  try{
   const libraryMode=$('ai-library').checked;turn.fromLibrary=libraryMode;turn.state='Understanding with Luna → planning with Sol';draw();
   const response=await fetch('/api/agent-turn',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','X-SoniLoom-Token':status.clientToken},body:JSON.stringify({requestId:turn.id,prompt,context:intentContext,reasoningEffort:settings.get().reasoningEffort,librarySummaryConsent:libraryMode})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'AI request failed');if(thisSession!==session)return;
   turn.message=data.message;turn.intentRecord=data.intentRecord;turn.meta=`Luna ${data.calls.luna}/3 · Sol ${data.calls.sol}/3 · Search ${data.calls.search}/2`;if(data.usage?.length)turn.meta+=' · '+data.usage.map(u=>`${u.role}: ${u.usage?.input_tokens??'?'} in / ${u.usage?.output_tokens??'?'} out`).join(' · ');
   if(owner!==getStore()||generation!==owner.generation)throw Error('Sound changed while AI was working. Proposal not applied; send a new request.');
   if(data.kind!=='proposal'){turn.changes=[];turn.state=data.kind==='clarification'?'Waiting for your answer · Sound unchanged':data.kind==='unavailable'?'No suitable plan · Sound unchanged':data.kind==='cancelled'?'Cancelled · Sound unchanged':'Discussion · Sound unchanged';remember(turn,data.kind==='clarification'?'clarification':data.kind==='cancelled'?'cancelled':data.kind==='unavailable'?'unavailable':'discussed');return;}
   const clips=[];turn.evidence=data.candidates||[];turn.trace=data.trace||[];
   for(const candidate of turn.evidence){controller.signal.throwIfAborted();const r=await fetch('/api/library/search/clip',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','X-SoniLoom-Token':status.clientToken},body:JSON.stringify({sessionId:data.sessionId,candidateId:candidate.candidateId})});if(!r.ok)throw Error((await r.json()).error);clips.push({candidateId:candidate.candidateId,name:candidate.name,sourceRef:JSON.parse(r.headers.get('X-SoniLoom-Source')),bytes:await r.arrayBuffer()});}
   const prepared=clips.length?await prepareArrangement(owner,data.proposal,clips,{scope}):prepareProposal(owner,data.proposal,{scope});
   if(prepared.changes.length){turn.state='Rendering detached preview…';draw();await finishPreview(turn,prepared);if(thisSession!==session){release(turn);return;}controller.signal.throwIfAborted();}else{turn.changes=[];turn.state='No sound changes proposed';}remember(turn,'proposed');

  }catch(e){if(thisSession===session){turn.error=true;turn.state=e.name==='AbortError'?'Cancelled · Sound unchanged':e.message;release(turn);remember(turn,e.name==='AbortError'?'cancelled':'failed');}}
  finally{busy=false;controller=null;await refreshStatus();draw();$('chat-messages').scrollTop=$('chat-messages').scrollHeight;if(thisSession===session)$('prompt').focus();}
 }
 $('chat-form').addEventListener('submit',submit);
 $('prompt').addEventListener('keydown',e=>{if(shouldSend(e,settings.get().sendShortcut,isMac)){e.preventDefault();$('chat-form').requestSubmit();}});
 $('cancel-prompt').onclick=()=>controller?.abort();
 $('clear-chat').onclick=()=>{session++;controller?.abort();turns.forEach(release);turns=[];resetMemory();draw();};
 refreshStatus();draw();
 return {sync,stopPreview(){for(const a of document.querySelectorAll('audio'))a.pause();},invalidateLibrary(){session++;controller?.abort();for(const t of turns)if(t.fromLibrary&&t.prepared){release(t);t.state='Outdated — library root changed';}draw();},async offerLibrary({candidate,clip,query}){if(busy)throw Error('Wait for the current request first');const owner=getStore(),generation=owner.generation,turn={prompt:`Local candidate: ${query}`,session,at:new Date(),owner,generation,scopeName:'Whole sound',fromLibrary:true,evidence:[candidate],message:'Prepared from bundle labels and local measurements. No AI call or semantic listening.',state:'Rendering detached preview…'};for(const t of turns)if(t.prepared){release(t);t.state='Superseded · Not applied';remember(t,'discarded');}turns.push(turn);busy=true;controller=new AbortController();draw();const proposal={message:turn.message,operations:[{kind:'add',layerId:'',source:'sample',changes:[{field:'assetId',value:candidate.candidateId},{field:'duration',value:Math.max(.05,Math.min(candidate.duration,owner.project.duration))},{field:'gain',value:.2}]}]};try{await finishPreview(turn,await prepareArrangement(owner,proposal,[clip],{scope:'all'}));controller.signal.throwIfAborted();draw();}catch(e){turn.error=true;turn.state=e.message;release(turn);draw();throw e;}finally{busy=false;controller=null;draw();}},reset(){session++;controller?.abort();turns.forEach(release);turns=[];resetMemory();draw();}};
}
