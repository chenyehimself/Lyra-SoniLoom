import {projectContext} from './ai-contract.mjs';
import {validateProject} from './project.mjs';
import {SAMPLE_FIELDS,sourceWindow} from './sample.mjs';

const fail = label => { throw new Error(`Invalid intent ${label}`); };
const object = (v, keys, label) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) fail(label);
};
const text = (v, max, label, nonempty = true) => {
  if (typeof v !== 'string' || v.length > max || (nonempty && !v.trim())) fail(label);
};
const id = v => text(v, 200, 'identity');
const strings = (v, maxItems, maxLength, label) => {
  if (!Array.isArray(v) || v.length > maxItems) fail(label);
  v.forEach(x => text(x, maxLength, label));
};
const unique = v => { if (new Set(v).size !== v.length) fail('duplicate reference'); };
const keys = ['status','intentKind','requestedOutcome','targetLayerIds','preserve','evidenceTurnIds','unknowns','assumptions','question'];
const str = maxLength => ({type:'string', maxLength});
const arr = (items, maxItems) => ({type:'array', items, maxItems});
const kinds = ['new_sound','revise_sound','discuss','clarify','cancel'];
export const INTENT_DECISION_SCHEMA = {
  type:'object', additionalProperties:false, required:keys,
  properties:{
    status:{type:'string',enum:['ready','needs_clarification']},
    intentKind:{type:'string',enum:kinds}, requestedOutcome:str(3000),
    targetLayerIds:arr(str(200),16),
    preserve:arr({type:'object',additionalProperties:false,required:['targetId','requirement','evidenceTurnIds'],properties:{targetId:str(200),requirement:str(500),evidenceTurnIds:arr(str(200),64)}},16),
    evidenceTurnIds:arr(str(200),64), unknowns:arr(str(500),12), assumptions:arr(str(500),12), question:str(1000)
  }
};

export function validateAnchor(anchor) {
  object(anchor,['sessionId','projectId','generation'],'anchor');
  id(anchor.sessionId); id(anchor.projectId);
  if (!Number.isSafeInteger(anchor.generation) || anchor.generation < 0) fail('generation');
}

// Accept only the existing project's cloud projection, never embedded source bytes.
export function validateIntentContext(context) {
  object(context,['anchor','scope','selectedLayerId','projectFacts','turns','corrections','pendingClarification'],'context');
  validateAnchor(context.anchor);
  const p = context.projectFacts;
  object(p,['schemaVersion','engine','id','name','duration','sampleRate','layers','assets'],'project facts');
  if (p.id !== context.anchor.projectId || !Array.isArray(p.assets) || p.assets.length > 16 || !Array.isArray(p.layers)) fail('project identity');
  const assets = {};
  for (const a of p.assets) {
    object(a, Object.hasOwn(a,'audio') ? ['id','name','audio'] : ['id','name'], 'asset');
    if (!/^[a-f0-9]{64}$/.test(a.id) || Object.hasOwn(assets,a.id)) fail('asset ID');
    text(a.name,200,'asset name',false);
    assets[a.id] = {name:a.name,...(a.audio ? {audio:a.audio} : {})};
  }
  const projected = projectContext({...p,assets});
  // Comparing normalized object keys prevents hidden nested payload fields.
  const canonical = value => JSON.stringify(value, function(k,v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])) : v;
  });
  if (canonical(projected) !== canonical(p)) fail('project projection');
  for (const layer of p.layers) {
    id(layer.id);
    if (typeof layer.color!=='string' || (layer.assetId!==null && (typeof layer.assetId!=='string' || !/^[a-f0-9]{64}$/.test(layer.assetId)))) fail('layer metadata');
    if (SAMPLE_FIELDS.some(k=>Object.hasOwn(layer,k))) {
      const audio=assets[layer.assetId]?.audio;
      if (p.schemaVersion<3 || layer.type!=='sample' || !audio) fail('source window metadata');
      sourceWindow(layer,audio.frames,audio.sampleRate);
    }
  }
  validateProject({...p,assets:{},layers:p.layers.map(l => l.type === 'sample'
    ? {...Object.fromEntries(Object.entries(l).filter(([k])=>!SAMPLE_FIELDS.includes(k))),type:'tone',assetId:null} : l)});
  const layerIds = new Set(p.layers.map(l=>l.id));
  for (const l of p.layers) if (l.type === 'sample' && !Object.hasOwn(assets,l.assetId)) fail('missing source metadata');
  if (context.scope !== 'all' && !layerIds.has(context.scope)) fail('scope');
  if (context.selectedLayerId !== null && !layerIds.has(context.selectedLayerId)) fail('selection');
  if (!Array.isArray(context.turns) || !Array.isArray(context.corrections)) fail('history');
  const turnIds = new Set();
  for (const t of context.turns) {
    validateContextTurn(t,context.anchor);
    if (turnIds.has(t.id)) fail('duplicate turn');
    turnIds.add(t.id);
  }
  const refs = refs => { strings(refs,64,200,'evidence'); unique(refs); if(refs.some(r=>!turnIds.has(r))) fail('missing evidence'); };
  for (const t of context.turns) { refs(t.evidenceTurnIds); refs(t.preserveEvidenceTurnIds); }
  for (const correction of context.corrections) {
    object(correction,['turnId','supersedesTurnId'],'correction');
    if (!turnIds.has(correction.turnId) || !turnIds.has(correction.supersedesTurnId) || correction.turnId===correction.supersedesTurnId) fail('correction reference');
  }
  const q = context.pendingClarification;
  if (q !== null) {
    object(q,['turnId','question','anchor'],'pending clarification'); validateAnchor(q.anchor);
    const turn = context.turns.find(t=>t.id===q.turnId);
    if (!turn || turn.outcome!=='clarification' || q.question!==turn.assistantText || canonical(q.anchor)!==canonical(context.anchor)) fail('stale clarification');
    text(q.question,1000,'question');
  }
  return structuredClone(context);
}

export function validateContextTurn(turn, anchor) {
  object(turn,['id','anchor','userText','assistantText','outcome','evidenceTurnIds','preserveEvidenceTurnIds'],'turn');
  id(turn.id); validateAnchor(turn.anchor);
  if (turn.anchor.projectId!==anchor.projectId || turn.anchor.sessionId!==anchor.sessionId || turn.anchor.generation>anchor.generation) fail('foreign turn');
  text(turn.userText,3000,'user text'); text(turn.assistantText,6000,'assistant text',false);
  if (!['clarification','proposed','applied','discarded','outdated','failed','cancelled','discussed','unavailable'].includes(turn.outcome)) fail('turn outcome');
  if (turn.outcome==='clarification') text(turn.assistantText,1000,'question');
  for (const refs of [turn.evidenceTurnIds,turn.preserveEvidenceTurnIds]) {strings(refs,64,200,'evidence');unique(refs);}
}

export function validateIntentDecision(raw, context) {
  validateIntentContext(context);
  object(raw,keys,'decision');
  if (!['ready','needs_clarification'].includes(raw.status) || !kinds.includes(raw.intentKind)) fail('status or kind');
  text(raw.requestedOutcome,3000,'outcome',raw.status==='ready'); text(raw.question,1000,'question',false);
  if ((raw.status==='needs_clarification') !== !!raw.question.trim()) fail('clarification question');
  for (const key of ['unknowns','assumptions']) strings(raw[key],12,500,key);
  strings(raw.targetLayerIds,16,200,'targets'); unique(raw.targetLayerIds);
  const targets = new Set(context.projectFacts.layers.filter(l=>context.scope==='all'||l.id===context.scope).map(l=>l.id));
  if (raw.targetLayerIds.some(x=>!targets.has(x))) fail('target scope');
  if (raw.status==='ready' && raw.intentKind==='revise_sound' && !raw.targetLayerIds.length) fail('revision targets');
  if (raw.intentKind==='new_sound' && context.scope!=='all') fail('new sound scope');
  const evidence = new Set(context.turns.map(t=>t.id));
  const checkEvidence = refs => {strings(refs,64,200,'evidence');unique(refs);if(refs.some(r=>!evidence.has(r)))fail('evidence reference');};
  checkEvidence(raw.evidenceTurnIds);
  if (!Array.isArray(raw.preserve) || raw.preserve.length>16) fail('preservation');
  for (const entry of raw.preserve) {
    object(entry,['targetId','requirement','evidenceTurnIds'],'preservation');
    if (!targets.has(entry.targetId)) fail('preservation scope');
    text(entry.requirement,500,'preservation requirement'); checkEvidence(entry.evidenceTurnIds);
  }
  if (['discuss','cancel','clarify'].includes(raw.intentKind) && (raw.targetLayerIds.length || raw.preserve.length)) fail('non-edit targets');
  return structuredClone(raw);
}

export function makeIntentRecord({requestId, originalText, context, decision}) {
  id(requestId); text(originalText,3000,'original text');
  return {requestId,anchor:structuredClone(context.anchor),originalText,decision:validateIntentDecision(decision,context)};
}
