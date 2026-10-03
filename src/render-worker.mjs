import {renderProject} from './engine.mjs';
self.onmessage=({data:{id,project,options}})=>{
 try{const result=renderProject(project,options);const transfer=[...result.channels,...Object.values(result.layers).flat(),...Object.values(result.stems).flat()].map(c=>c.buffer);self.postMessage({id,result},transfer);}catch(error){self.postMessage({id,error:error.message});}
};
