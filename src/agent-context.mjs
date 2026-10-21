import {projectContext} from './ai-contract.mjs';
import {validateProject} from './project.mjs';
import {validateAnchor,validateContextTurn,validateIntentContext} from './intent-contract.mjs';

/** Session-only context. All outcomes are supplied by local application events. */
export function createAgentContext(identity) {
  let sessionId, projectId, generation = null;
  const turns = new Map(), corrections = new Map();
  function reset(next) {
    validateAnchor({...next,generation:0});
    ({sessionId,projectId}=next); generation=null; turns.clear(); corrections.clear();
  }
  reset(identity);
  function recordTurn(raw) {
    const turn=structuredClone(raw);
    validateContextTurn(turn,{sessionId,projectId,generation:generation??turn.anchor?.generation});
    const prior=turns.get(turn.id);
    if (prior && (prior.userText!==turn.userText || prior.anchor.generation!==turn.anchor.generation)) throw Error('Cannot rewrite turn identity or user text');
    for (const ref of [...turn.evidenceTurnIds,...turn.preserveEvidenceTurnIds]) {
      if (ref!==turn.id && !turns.has(ref)) throw Error('Missing referenced evidence');
      if (prior && ref!==turn.id && [...turns.keys()].indexOf(ref)>[...turns.keys()].indexOf(turn.id)) throw Error('Turn evidence must not point forward');
    }
    turns.set(turn.id,turn);
  }
  function correct({turnId,supersedesTurnId}) {
    const ids=[...turns.keys()], index=ids.indexOf(turnId), prior=ids.indexOf(supersedesTurnId);
    if (prior<0 || index<=prior) throw Error('Correction must refer to an earlier existing turn');
    if (corrections.has(turnId) && corrections.get(turnId)!==supersedesTurnId) throw Error('Correction identity is immutable');
    corrections.set(turnId,supersedesTurnId);
  }
  function snapshot({project,generation:nextGeneration,scope,selectedLayerId}) {
    validateProject(project);
    validateAnchor({sessionId,projectId:project.id,generation:nextGeneration});
    if (project.id===projectId && generation!==null && nextGeneration<generation) throw Error('Stale project generation; reset context when opening a project');
    // Project identity changes cannot carry old referents into the new sound.
    const changed=project.id!==projectId;
    const source=changed?[]:[...turns.values()];
    const selected=new Set(source.slice(-10).map(t=>t.id));
    // Keep original evidence and correction chains for every projected turn.
    const queue=[...selected];
    while(queue.length) {
      const id=queue.shift(),turn=turns.get(id);
      for(const ref of [...turn.evidenceTurnIds,...turn.preserveEvidenceTurnIds,...(corrections.has(id)?[corrections.get(id)]:[]),...[...corrections].filter(([,old])=>old===id).map(([correction])=>correction)]) {
        if (!turns.has(ref)) throw Error('Missing referenced evidence');
        if (!selected.has(ref)) {selected.add(ref);queue.push(ref);}
      }
    }
    const anchor={sessionId,projectId:project.id,generation:nextGeneration};
    const last=source.at(-1);
    const pendingClarification=last?.outcome==='clarification' && last.anchor.generation===nextGeneration
      ? {turnId:last.id,question:last.assistantText,anchor:{...anchor}} : null;
    const context={anchor,scope,selectedLayerId,projectFacts:projectContext(project),turns:source.filter(t=>selected.has(t.id)),corrections:changed?[]:[...corrections].filter(([id])=>selected.has(id)).map(([turnId,supersedesTurnId])=>({turnId,supersedesTurnId})),pendingClarification};
    const clean=validateIntentContext(context);
    if(new TextEncoder().encode(JSON.stringify(clean)).length>64*1024) throw Error('Context too large; required evidence was not dropped');
    if(changed) reset({sessionId,projectId:project.id});
    generation=nextGeneration;
    return clean;
  }
  return {recordTurn,correct,snapshot,reset};
}
