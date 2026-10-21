import {skillInstructions} from './skills.mjs';
import {INTENT_DECISION_SCHEMA,validateIntentContext,makeIntentRecord} from '../src/intent-contract.mjs';

const instructions = skillInstructions('luna');

export class IntentServiceError extends Error {
  constructor(code,message) {super(message);this.name='IntentServiceError';this.code=code;}
}
const error = (code,message) => new IntentServiceError(code,message);
const sameAnchor = (a,b) => a?.sessionId===b.sessionId && a?.projectId===b.projectId && a?.generation===b.generation;

/** No network, key, budget or production route. Invocation is supplied by the caller. */
export function createIntentService({invokeLuna}) {
  if (typeof invokeLuna!=='function') throw error('INVALID_INTENT_INPUT','An intent invoker is required');
  return {
    async interpret({requestId,prompt,context,professionalQuestion}, {signal}={}) {
      signal?.throwIfAborted();
      let snapshot;
      try {
        if (typeof requestId!=='string'||!requestId.trim()||requestId.length>200||typeof prompt!=='string'||!prompt.trim()||prompt.length>3000) throw Error();
        snapshot=validateIntentContext(context);
      } catch {throw error('INVALID_INTENT_INPUT','Invalid intent request or context');}
      if(professionalQuestion!==undefined&&(typeof professionalQuestion!=='string'||professionalQuestion.length>1000))throw error('INVALID_INTENT_INPUT','Invalid professional question');
      const input={originalText:prompt,context:snapshot,...(professionalQuestion?{professionalQuestion,task:'Phrase this professional ambiguity as a clarification question. Do not plan or apply changes.'}:{})};
      const payload={instructions,input,schema:structuredClone(INTENT_DECISION_SCHEMA)};
      if (new TextEncoder().encode(JSON.stringify(payload)).length>64*1024) throw error('INTENT_PAYLOAD_TOO_LARGE','Intent context exceeds the provider payload limit; no call sent');
      let raw;
      try {raw=await invokeLuna(structuredClone(payload),{signal});}
      catch {
        signal?.throwIfAborted();
        throw error('INTENT_PROVIDER_FAILED','Intent request failed; no retry or project change');
      }
      signal?.throwIfAborted();
      if (!sameAnchor(context.anchor,snapshot.anchor)) throw error('STALE_INTENT_CONTEXT','Project context changed during intent understanding');
      try {const wrapped=raw?.providerMeta&&raw?.decision;return {...makeIntentRecord({requestId,originalText:prompt,context:snapshot,decision:wrapped?raw.decision:raw}),...(wrapped?{providerMeta:raw.providerMeta}:{})};}
      catch {throw error('INVALID_INTENT_OUTPUT','Invalid intent response; no retry or project change');}
    }
  };
}
