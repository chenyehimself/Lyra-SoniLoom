import {readFileSync} from 'node:fs';

// Fixed server-owned paths: user/catalog text cannot select a file or a role bundle.
const files=Object.freeze({
 luna:['intent-understanding/SKILL.md'],
 sol:['sound-design-planning/SKILL.md','sound-design-planning/references/source-selection.md','sound-design-planning/references/evidence-and-analysis.md','sound-design-planning/references/engine-and-editing.md']
});
const cache=new Map();
export function skillInstructions(role){
 if(!Object.hasOwn(files,role))throw Error('Unknown skill role');
 if(!cache.has(role)){
  const content=files[role].map(file=>{
   let text;try{text=readFileSync(new URL(`../skills/${file}`,import.meta.url),'utf8').trim();}catch{throw Error(`Required application skill unavailable: ${file}`);}
   if(!text)throw Error(`Required application skill empty: ${file}`);
   return text;
  }).join('\n\n');
  cache.set(role,content);
 }
 return cache.get(role);
}
