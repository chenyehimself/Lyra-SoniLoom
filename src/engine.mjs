import {sourceWindow} from './sample.mjs';
import {renderRoom} from './spatial.mjs';
import {validateProject} from './project.mjs';
import {decodeWav,fromBase64} from './wav.mjs';
const TAU=Math.PI*2;
function random(seed){let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/2147483648-1;};}
function sample(channel,pos,first=0,end=channel.length){const i=Math.floor(pos),f=pos-i;return i<first||i>=end?0:channel[i]*(1-f)+(i+1<end?channel[i+1]||0:0)*f;}
function selectedSample(channel,offset,first,end,reverse){const i=Math.floor(offset),f=offset-i,at=k=>{const index=reverse?end-1-k:first+k;return index>=first&&index<end?channel[index]:0;};return at(i)*(1-f)+at(i+1)*f;}
/** Independent layer DSP, no shared state and no layer-dependent normalization. */
export function renderLayer(layer,project,decoded){
 const sr=project.sampleRate,n=Math.round(project.duration*sr),channels=[new Float32Array(n),new Float32Array(n)],offset=Math.round(layer.start*sr),frames=Math.round(layer.duration*sr),rand=random(layer.seed);
 let phase=0,sub=0,lpL=0,lpR=0,hpL=0,hpR=0,prevL=0,prevR=0;
 const panL=Math.cos((layer.pan+1)*Math.PI/4),panR=Math.sin((layer.pan+1)*Math.PI/4);
 const delayN=Math.max(1,Math.round(layer.delay*sr)),dl=new Float32Array(delayN),dr=new Float32Array(delayN+Math.round(.013*sr));
 const asset=layer.type==='sample'?decoded[layer.assetId]:null;
 const window=asset&&project.schemaVersion>=3?sourceWindow(layer,asset.channels[0].length,asset.sampleRate):null;
 const selected=window?.selected,activeDuration=selected?Math.min(layer.duration,window.duration/layer.rate):layer.duration,activeFrames=selected?Math.min(frames,Math.ceil(activeDuration*sr)):frames;
 for(let i=0;i<n-offset;i++){
  let left=0,right=0;const t=i/sr,u=Math.min(1,t/layer.duration);
  if(i<activeFrames){
   const freq=layer.frequency*Math.pow(layer.endFrequency/layer.frequency,u),noise=rand();phase=(phase+freq/sr)%1;sub=(sub+freq*.5/sr)%1;
   const attack=Math.min(1,t/layer.attack),release=Math.min(1,(activeDuration-t)/layer.release),env=Math.sin(Math.max(0,attack)*Math.PI/2)*Math.sin(Math.max(0,release)*Math.PI/2);
   if(asset){let pos=t*asset.sampleRate*layer.rate;if(selected){left=selectedSample(asset.channels[0],pos,window.first,window.end,layer.reverse);right=selectedSample(asset.channels[1]||asset.channels[0],pos,window.first,window.end,layer.reverse);}else{if(layer.reverse)pos=asset.channels[0].length-1-pos;left=sample(asset.channels[0],pos);right=sample(asset.channels[1]||asset.channels[0],pos);}}
   else {
    const sine=Math.sin(TAU*phase),harmonic=.5*Math.sin(TAU*phase*2)+.25*Math.sin(TAU*phase*3);
    if(layer.type==='tone')left=(sine+layer.texture*harmonic)*.7;
    if(layer.type==='noise')left=noise*(.65+.35*Math.sin(TAU*t*(3+layer.texture*12))**2);
    if(layer.type==='mechanical'){const pulse=Math.max(0,Math.sin(TAU*(9*t+4*t*t)));left=(.4*sine+.2*harmonic+noise*layer.texture*.6)*(.2+.8*pulse**8);}
    if(layer.type==='riser')left=(.45*sine+.22*harmonic+noise*layer.texture*.7)*(.12+.88*u*u)*(.8+.2*Math.sin(TAU*(4*t+6*t*t)));
    if(layer.type==='impact')left=(.7*sine+.3*Math.sin(TAU*sub))*Math.exp(-t*3)+noise*layer.texture*Math.exp(-t*6);
    right=left;
   }
   const cutoff=layer.type==='riser'?layer.cutoff*(.15+.85*u):layer.cutoff,alpha=1-Math.exp(-TAU*cutoff/sr);
   lpL+=alpha*(left-lpL);lpR+=alpha*(right-lpR);
   const drive=1+layer.drive*9;left=Math.tanh(lpL*drive)/Math.tanh(drive);right=Math.tanh(lpR*drive)/Math.tanh(drive);
   // Stable DC blocker, then envelope, then independent stereo delay.
   hpL=left-prevL+.997*hpL;hpR=right-prevR+.997*hpR;prevL=left;prevR=right;
   left=hpL*env*layer.gain*panL;right=hpR*env*layer.gain*panR;
  }
  const a=i%dl.length,b=i%dr.length,echoL=dl[a],echoR=dr[b];dl[a]=left+echoR*.34;dr[b]=right+echoL*.34;
  const tail=Math.min(1,(n-offset-i)/Math.round(.02*sr));
  channels[0][offset+i]=(left+echoL*layer.wet)*tail;channels[1][offset+i]=(right+echoR*layer.wet)*tail;
 }
 return channels;
}
export function renderProject(project,{onlyLayerId=null,mutedIds=[],soloIds=[]}={}){
 validateProject(project);const decoded={};for(const [id,a]of Object.entries(project.assets))decoded[id]=decodeWav(fromBase64(a.data));
 const n=Math.round(project.duration*project.sampleRate),channels=[new Float32Array(n),new Float32Array(n)],layers={};
 const stems=Object.fromEntries(['dry','early','late'].map(k=>[k,[new Float32Array(n),new Float32Array(n)]]));
 for(const l of project.layers){const pcm=renderLayer(l,project,decoded);const room=project.schemaVersion>=2?renderRoom(pcm,l,project.sampleRate):null;
  const full=room?pcm.map((ch,c)=>Float32Array.from(ch,(x,i)=>x+room.early[c][i]+room.late[c][i])):pcm;layers[l.id]=full;
  const audible=onlyLayerId?l.id===onlyLayerId:(!mutedIds.includes(l.id)&&(!soloIds.length||soloIds.includes(l.id)));if(audible)for(let c=0;c<2;c++)for(let i=0;i<n;i++){channels[c][i]+=full[c][i];stems.dry[c][i]+=pcm[c][i];if(room){stems.early[c][i]+=room.early[c][i];stems.late[c][i]+=room.late[c][i];}}
 }
 let peak=0,sum=0,clipped=0;for(let i=0;i<n;i++)for(let c=0;c<2;c++){const x=channels[c][i];peak=Math.max(peak,Math.abs(x));sum+=x*x;if(Math.abs(x)>1)clipped++;}
 return {sampleRate:project.sampleRate,channels,layers,stems,peak,rms:Math.sqrt(sum/(n*2)),clipped};
}
/** Audition-only RMS matching: attenuation only; never alters render/project data. */
export function comparisonGains(current,reference){
 const rms=chs=>Math.sqrt(chs.reduce((sum,ch)=>sum+ch.reduce((s,x)=>s+x*x,0),0)/(chs[0].length*chs.length));
 const a=rms(current),b=rms(reference);if(!a||!b)return {current:1,reference:1};
 return {current:Math.min(1,b/a),reference:Math.min(1,a/b)};
}
/** Select audible PCM, then level-match the actual current selection against its reference. */
export function auditionChannels(result,{component='full',reference=null,referenceMode=false,mutedIds=[],soloIds=[],match=false}={}){
 if(component!=='full')return result.stems[component];
 let current=result.channels;
 if(mutedIds.length||soloIds.length){
  current=result.channels.map(ch=>new Float32Array(ch.length));
  for(const [id,pcm] of Object.entries(result.layers))if(!mutedIds.includes(id)&&(!soloIds.length||soloIds.includes(id)))for(let c=0;c<2;c++)for(let i=0;i<current[c].length;i++)current[c][i]+=pcm[c][i];
 }
 const channels=referenceMode&&reference?reference.channels:current;
 if(!match||!reference)return channels;
 const gains=comparisonGains(current,reference.channels),gain=referenceMode?gains.reference:gains.current;
 return channels.map(ch=>Float32Array.from(ch,x=>x*gain));
}
