import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectWav} from './library-audio.mjs';
export const ANALYSIS_PROFILE='signal-v1-10ms-60db-bands200-2000';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const analysisKey=sha=>digest(JSON.stringify({formatVersion:1,sourceSha256:sha,profile:ANALYSIS_PROFILE}));
const cancelled=signal=>signal?.throwIfAborted();
const fingerprint=s=>`${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;
export async function hashFile(file,{signal}={}){
 const f=await open(file,'r');try{const h=createHash('sha256'),b=Buffer.alloc(256*1024);let at=0;for(;;){cancelled(signal);const {bytesRead}=await f.read(b,0,b.length,at);if(!bytesRead)break;h.update(b.subarray(0,bytesRead));at+=bytesRead;}return h.digest('hex');}finally{await f.close();}
}
function amplitude(b,p,a){if(a.format===3)return b.readFloatLE(p);if(a.bits===8)return (b[p]-128)/128;if(a.bits===16)return b.readInt16LE(p)/32768;if(a.bits===24)return b.readIntLE(p,3)/8388608;return b.readInt32LE(p)/2147483648;}
/** Full PCM pass. Tags are catalog evidence; no semantic inference is performed. */
export async function analyzeWav(file,expectedHash,{signal}={}){
 cancelled(signal);const a=await inspectWav(file);if(a.unsupported)throw Error(a.unsupported);
 const f=await open(file,'r');try{
  const before=await f.stat();if(await hashFile(file,{signal})!==expectedHash)throw Error('Source hash does not match catalog identity');
  let peak=0,peakFrame=0,sum=0,activeFrames=0,clippedSamples=0,eventStart=null,lastActive=0;
  const segments=[],low=new Float64Array(a.channels),mid=new Float64Array(a.channels),energy=[0,0,0];let segmentCount=0;
  const windowFrames=Math.max(1,Math.round(a.sampleRate*.01)),gapFrames=Math.round(a.sampleRate*.1),alphaLow=1-Math.exp(-2*Math.PI*200/a.sampleRate),alphaMid=1-Math.exp(-2*Math.PI*2000/a.sampleRate);
  const buf=Buffer.alloc(Math.floor(256*1024/a.align)*a.align);let windowPeak=0,windowStart=0;
  const finishEvent=()=>{if(eventStart===null)return;segmentCount++;if(segments.length<128)segments.push({segmentId:`event-${segmentCount}`,firstFrame:eventStart,endFrame:Math.min(a.frames,lastActive),boundaryStatus:'estimated',boundaryMethod:'10ms-energy-threshold-minus60dbfs-gap100ms'});eventStart=null;};
  const finishWindow=end=>{if(windowPeak>=.001){if(eventStart===null)eventStart=windowStart;lastActive=end;}else if(eventStart!==null&&end-lastActive>=gapFrames)finishEvent();windowPeak=0;windowStart=end;};
  for(let frame=0;frame<a.frames;){cancelled(signal);const length=Math.min(buf.length,(a.frames-frame)*a.align),{bytesRead}=await f.read(buf,0,length,a.offset+frame*a.align);if(bytesRead!==length)throw Error('Truncated source during analysis');
   for(let p=0;p<length;p+=a.align,frame++){
    let framePeak=0;for(let c=0;c<a.channels;c++){const x=amplitude(buf,p+c*a.bits/8,a);if(!Number.isFinite(x))throw Error('Non-finite audio sample');const abs=Math.abs(x);if(abs>peak){peak=abs;peakFrame=frame;}framePeak=Math.max(framePeak,abs);sum+=x*x;if(abs>1)clippedSamples++;low[c]+=alphaLow*(x-low[c]);mid[c]+=alphaMid*(x-mid[c]);energy[0]+=low[c]**2;energy[1]+=(mid[c]-low[c])**2;energy[2]+=(x-mid[c])**2;}
    if(framePeak>=.001)activeFrames++;windowPeak=Math.max(windowPeak,framePeak);if(frame+1-windowStart>=windowFrames)finishWindow(frame+1);
   }
   await new Promise(resolve=>setImmediate(resolve));
  }
  if(windowStart<a.frames)finishWindow(a.frames);finishEvent();cancelled(signal);
  if(fingerprint(await f.stat())!==fingerprint(before))throw Error('Source changed during analysis');
  const rms=Math.sqrt(sum/(a.frames*a.channels)),db=x=>x>0?20*Math.log10(x):null;
  return {format:'soniloom-audio-analysis',formatVersion:1,analysisKey:analysisKey(expectedHash),sourceSha256:expectedHash,profile:ANALYSIS_PROFILE,status:'complete',semanticSource:'bundle_tags_only',audio:{sampleRate:a.sampleRate,channels:a.channels,frames:a.frames,bits:a.bits},measurements:{coverage:'full',peak,peakDbfs:db(peak),peakFrame,rms,rmsDbfs:db(rms),crestDb:rms?db(peak/rms):null,activeFrames,clippedSamples,activityThresholdDbfs:-60,bandEnergyEstimate:{method:'first-order-filter-residuals-not-orthogonal-spectrum',low:energy[0]/(a.frames*a.channels),mid:energy[1]/(a.frames*a.channels),high:energy[2]/(a.frames*a.channels)}},segments,segmentsTruncated:segmentCount>segments.length,totalEvents:segmentCount};
 }finally{await f.close();}
}
