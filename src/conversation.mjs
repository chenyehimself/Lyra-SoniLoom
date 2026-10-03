import {projectContext,prepareProposal,applyProposal} from './ai-contract.mjs';
const $=id=>document.getElementById(id);
const node=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const value=x=>x===null?'—':typeof x==='object'?JSON.stringify(x):String(x);

export function createConversation({getStore,getSelected,onApply}){
 let turns=[],busy=false,session=0,status=null;
 async function refreshStatus(){
  try{const res=await fetch('/api/status');const data=await res.json();if(!res.ok)throw Error(data.error);status=data;
   $('provider-state').textContent=data.configured?'OpenAI · ready':'API key missing';
   $('provider-state').title=data.model+' · Configuration detected; request results verify availability.';
   $('ai-budget').textContent=`$${data.budget.estimatedUSD.toFixed(4)} estimated · $${data.budget.remainingUSD.toFixed(2)} test allowance`;
  }catch{status=null;$('provider-state').textContent='AI unavailable';$('ai-budget').textContent='Local AI service could not be reached';}
  $('send-prompt').disabled=busy||!status?.configured;
 }
 function invalidate(){
  const s=getStore();for(const t of turns)if(t.prepared&&(t.owner!==s||t.generation!==s.generation)){t.prepared=null;t.state='Outdated — sound changed. Send a new request.';}
 }
 function draw(){
  invalidate();const list=$('chat-messages');list.replaceChildren();
  if(!turns.length){const welcome=node('div','chat-welcome');welcome.append(node('span','eyebrow','YOUR SOUND, IN WORDS'),node('h3','','What would you like to hear?'),node('p','','Describe a sound, then refine its layers. Every AI change stays editable.'));list.append(welcome);
   for(const text of ['Create a short, three-layer spaceship startup.','Make the current sound darker and less harsh.']){const b=node('button','prompt-starter',text);b.onclick=()=>{$('prompt').value=text;$('prompt').focus();};list.append(b);}
  }
  for(const t of turns){const article=node('article','chat-turn');article.append(node('div','user-message',t.prompt));
   if(t.message&&!t.error){article.append(node('div','assistant-label',t.prepared?'AI proposal · not applied':'AI response'),node('p','assistant-message',t.message));}
   if(t.changes?.length){const details=node('details','proposal-details');const summary=node('summary','',`${t.changes.length} changes · ${t.scopeName}`);details.append(summary);
    const ul=node('ul','change-list');for(const c of t.changes){const li=node('li');li.append(node('strong','',`${c.target} · ${c.field}`),node('span','',`${value(c.before)} → ${value(c.after)}`));ul.append(li);}details.append(ul);article.append(details);
   }
   const state=node('p','turn-state',t.state||'');if(t.error)state.classList.add('error');article.append(state);
   if(t.prepared&&t.changes.length){const actions=node('div','proposal-actions');const apply=node('button','primary','Apply changes'),dismiss=node('button','','Discard');
    apply.onclick=()=>{try{applyProposal(getStore(),t.prepared);t.prepared=null;t.state='Applied · Undo is available';onApply();draw();}catch(e){t.prepared=null;t.error=true;t.state=e.message;draw();}};
    dismiss.onclick=()=>{t.prepared=null;t.state='Discarded · Sound unchanged';draw();};actions.append(apply,dismiss);article.append(actions);
   }
   if(t.meta)article.append(node('small','turn-meta',t.meta));list.append(article);
  }
  if(busy)list.append(node('p','thinking','Designing your sound…'));
  $('send-prompt').disabled=busy||!status?.configured;$('prompt').disabled=busy;
 }
 function sync(){invalidate();draw();const id=getSelected(),layer=getStore().project.layers.find(l=>l.id===id);$('selected-scope').disabled=!layer;$('selected-scope').textContent=layer?`Selected layer: ${layer.name}`:'Selected layer';if(!layer&&$('ai-scope').value==='selected')$('ai-scope').value='all';}
 async function submit(event){
  event.preventDefault();const prompt=$('prompt').value.trim();if(!prompt||busy)return;
  if(!status?.configured){await refreshStatus();if(!status?.configured)return;}
  const owner=getStore(),generation=owner.generation,project=owner.project,scope=$('ai-scope').value==='selected'?getSelected():'all';
  const history=turns.flatMap(t=>[{role:'user',content:t.prompt},{role:'assistant',content:`${t.message||''}\n[${t.state||'Not applied'}]`}]).slice(-10);
  for(const t of turns)if(t.prepared){t.prepared=null;t.state='Superseded · Not applied';}
  const turn={prompt,owner,generation,scopeName:scope==='all'?'Whole sound':project.layers.find(l=>l.id===scope)?.name||'Selected layer',state:'Waiting for OpenAI'};turns.push(turn);busy=true;const thisSession=session;$('prompt').value='';draw();
  try{
   const response=await fetch('/api/propose',{method:'POST',headers:{'Content-Type':'application/json','X-SoniLoom-Token':status.clientToken},body:JSON.stringify({prompt,scope,project:projectContext(project),history})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'AI request failed');if(thisSession!==session)return;
   turn.message=data.proposal.message;turn.meta=`${data.model} · ${data.usage?.input_tokens??'?'} in / ${data.usage?.output_tokens??'?'} out`;
   if(owner!==getStore()||generation!==owner.generation)throw Error('Sound changed while AI was working. Proposal not applied; send a new request.');
   turn.prepared=prepareProposal(owner,data.proposal,{scope});turn.changes=turn.prepared.changes;turn.state=turn.changes.length?'Ready to review · Sound unchanged':'No sound changes proposed';
  }catch(e){if(thisSession===session){turn.error=true;turn.state=e.message;turn.prepared=null;}}
  finally{busy=false;await refreshStatus();draw();$('chat-messages').scrollTop=$('chat-messages').scrollHeight;if(thisSession===session)$('prompt').focus();}
 }
 $('chat-form').addEventListener('submit',submit);
 $('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chat-form').requestSubmit();}});
 $('clear-chat').onclick=()=>{session++;turns=[];draw();};
 refreshStatus();draw();
 return {sync,reset(){session++;turns=[];draw();}};
}
