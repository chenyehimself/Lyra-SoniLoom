/** Source windows use original recording seconds, quantized to its sample frames. */
export const SAMPLE_FIELDS=['sourceIn','sourceOut'];
export function sourceWindow(layer,frames,sampleRate){
 const hasIn=Object.hasOwn(layer,'sourceIn'),hasOut=Object.hasOwn(layer,'sourceOut');
 if(hasIn!==hasOut)throw Error('Source selection requires both sourceIn and sourceOut');
 if(!hasIn)return {first:0,end:frames,duration:frames/sampleRate,selected:false};
 const a=layer.sourceIn,b=layer.sourceOut,duration=frames/sampleRate;
 if(typeof a!=='number'||typeof b!=='number'||!Number.isFinite(a)||!Number.isFinite(b)||a<0||b>duration||b<=a)throw Error('Source selection must fit inside the recording');
 const first=Math.round(a*sampleRate),end=Math.round(b*sampleRate);
 if(first<0||end>frames||end<=first)throw Error('Source selection must contain at least one sample frame');
 return {first,end,duration:(end-first)/sampleRate,selected:true};
}
export function measureAudio(decoded){
 const {channels,sampleRate}=decoded,frames=channels[0].length;let peak=0,peakFrame=0,sum=0;
 for(let i=0;i<frames;i++)for(const ch of channels){const a=Math.abs(ch[i]);if(a>peak){peak=a;peakFrame=i;}sum+=ch[i]*ch[i];}
 let onsetFrame=null;
 if(peak>0)for(let i=0;i<frames;i++)if(channels.some(ch=>Math.abs(ch[i])>=peak*.1)){onsetFrame=i;break;}
 return {frames,sampleRate,channels:channels.length,duration:frames/sampleRate,peak,rms:Math.sqrt(sum/(frames*channels.length)),peakTime:peak?peakFrame/sampleRate:null,amplitudeOnset:onsetFrame===null?null:onsetFrame/sampleRate};
}
/** Whitelist measurement-only provider context; never forward arbitrary client properties. */
export function validateAudioMetadata(a){
 if(!a||typeof a!=='object'||Array.isArray(a))throw Error('Invalid audio measurements');
 const out=Object.fromEntries(['frames','sampleRate','channels','duration','peak','rms','peakTime','amplitudeOnset'].map(k=>[k,a[k]]));
 if(!Number.isInteger(out.frames)||out.frames<1||!Number.isInteger(out.sampleRate)||out.sampleRate<8000||out.sampleRate>192000||![1,2].includes(out.channels)||out.frames/out.sampleRate>30||out.duration!==out.frames/out.sampleRate)throw Error('Invalid recording duration measurements');
 for(const k of ['peak','rms'])if(typeof out[k]!=='number'||!Number.isFinite(out[k])||out[k]<0||out[k]>4)throw Error('Invalid recording level measurements');
 for(const k of ['peakTime','amplitudeOnset'])if(out[k]!==null&&(typeof out[k]!=='number'||!Number.isFinite(out[k])||out[k]<0||out[k]>=out.duration))throw Error('Invalid recording position measurements');
 return out;
}
export function selectionFromDrag(a,b,width,frames,sampleRate){
 if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(width)||width<=0)throw Error('Invalid waveform selection');
 const frame=x=>Math.round(Math.max(0,Math.min(1,x/width))*frames),first=Math.min(frame(a),frame(b)),end=Math.max(frame(a),frame(b));
 const patch={sourceIn:first/sampleRate,sourceOut:end/sampleRate};sourceWindow(patch,frames,sampleRate);return patch;
}
