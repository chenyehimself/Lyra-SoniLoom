import {decodeWav,toBase64,sha256} from './wav.mjs';
import {createLayer} from './project.mjs';
export async function importWav(buffer,name,project){
 const decoded=decodeWav(buffer),hash=await sha256(buffer),duration=decoded.channels[0].length/decoded.sampleRate;
 const asset={hash,name:name.slice(0,200),data:toBase64(buffer)};
 const layer={...createLayer('sample',project.layers.length),name:name.replace(/\.wav$/i,'').slice(0,100),assetId:hash,duration:Math.max(.05,Math.min(duration,project.duration)),gain:.6,attack:.005,release:.03,cutoff:18000};
 if(project.schemaVersion>=3){layer.sourceIn=0;layer.sourceOut=duration;}
 return {asset,layer};
}
