import {importWav} from './assets.mjs';
import {prepareProposal,preparedProject,validateProposal} from './ai-contract.mjs';
import {validateSourceRef} from './library-contract.mjs';
import {decodeWav} from './wav.mjs';
export const previewProject=preparedProject;
/** Materialize all clips before preparing one authoritative project transaction. */
export async function prepareArrangement(store,proposal,clips,{scope='all'}={}){
 validateProposal(proposal);if(clips?.length&&store.project.schemaVersion<3)throw Error('Enable sample editing before preparing library sources; legacy rendering is preserved until you opt in');const generation=store.generation,project=store.project,samples=new Map();
 if(!Array.isArray(clips)||clips.length>16)throw Error('Too many library assets');
 for(const clip of clips){if(typeof clip.candidateId!=='string'||!/^candidate_[a-f0-9-]{36}$/.test(clip.candidateId)||samples.has(clip.candidateId))throw Error('Invalid or duplicate candidate');const bytes=clip.bytes instanceof ArrayBuffer?clip.bytes:clip.bytes.buffer.slice(clip.bytes.byteOffset,clip.bytes.byteOffset+clip.bytes.byteLength);const imported=await importWav(bytes,`${clip.name||'Library selection'}.wav`,project);validateSourceRef(clip.sourceRef,imported.asset.hash,decodeWav(bytes));samples.set(clip.candidateId,{...imported,sourceRef:clip.sourceRef});}
 for(const op of proposal.operations){const id=op.changes.find(c=>c.field==='assetId')?.value;if(op.kind==='add'&&op.source==='sample'&&typeof id==='string'&&id.startsWith('candidate_')&&!samples.has(id))throw Error('Missing candidate asset');}
 if(store.generation!==generation)throw Error('Stale proposal: sound changed during preparation');
 return prepareProposal(store,proposal,{scope,librarySamples:samples});
}
