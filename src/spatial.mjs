/** Owned algorithmic room, version 0.3. Per-layer and deterministic; not geometric simulation. */
export const ROOM_DEFAULTS={roomEarly:0,roomLate:0,roomSize:6,roomDecay:.8,roomDamping:5000,roomPredelay:.01};
export const ROOM_RANGES={roomEarly:[0,.6],roomLate:[0,.6],roomSize:[2,20],roomDecay:[.15,4],roomDamping:[500,16000],roomPredelay:[0,.12]};
export const ROOM_FIELDS=Object.keys(ROOM_DEFAULTS);
export function renderRoom(channels,layer,sr){
 const cfg={...ROOM_DEFAULTS,...Object.fromEntries(ROOM_FIELDS.filter(k=>layer[k]!==undefined).map(k=>[k,layer[k]]))};
 const n=channels[0].length,early=[new Float32Array(n),new Float32Array(n)],late=[new Float32Array(n),new Float32Array(n)];
 if(!cfg.roomEarly&&!cfg.roomLate)return {early,late};
 const read=(c,pos)=>{const i=Math.floor(pos);if(i<0||i>=n)return 0;const f=pos-i;return c[i]*(1-f)+(c[i+1]||0)*f;};
 const alpha=1-Math.exp(-2*Math.PI*cfg.roomDamping/sr);
 // Six unequal path lengths with stereo crossfeed and frequency-dependent absorption.
 if(cfg.roomEarly){
  const paths=[1,1.37,1.83,2.41,3.17,4.09],weights=[.36,.27,.2,.14,.1,.07];
  for(let k=0;k<paths.length;k++)for(let c=0;c<2;c++){
   const delay=(cfg.roomPredelay+cfg.roomSize/343*paths[k]*(c?1.13:.97))*sr;let lp=0;
   for(let i=0;i<n;i++){const x=read(channels[c],i-delay)*.72+read(channels[1-c],i-delay)*.28;lp+=alpha*(x-lp);early[c][i]+=lp*weights[k]*cfg.roomEarly;}
  }
 }
 if(cfg.roomLate){
  // Parallel damped feedback combs followed by two all-pass diffusion stages.
  // Feedback derives from the requested decay; damping makes high frequencies decay sooner.
  for(let c=0;c<2;c++){
   const scale=Math.sqrt(cfg.roomSize/6),delays=[.0297,.0371,.0411,.0437].map((d,k)=>Math.max(1,Math.round((d+c*.0017*(k+1))*scale*sr)));
   const buffers=delays.map(d=>new Float32Array(d)),feedback=delays.map(d=>Math.pow(.001,d/sr/cfg.roomDecay)),lp=new Float64Array(4);
   const aps=[.0051,.0017].map(d=>new Float32Array(Math.round((d+c*.00037)*sr)));
   const pre=Math.round((cfg.roomPredelay+cfg.roomSize/343*1.5)*sr);
   for(let i=0;i<n;i++){
    const at=i-pre,x=at<0?0:channels[c][at]*.75+channels[1-c][at]*.25;let sum=0;
    for(let k=0;k<4;k++){const b=buffers[k],pos=i%b.length,y=b[pos];lp[k]+=alpha*(y-lp[k]);b[pos]=x+feedback[k]*lp[k];sum+=y*.25;}
    for(const b of aps){const pos=i%b.length,delayed=b[pos],out=delayed-.5*sum;b[pos]=sum+.5*out;sum=out;}
    late[c][i]=sum*cfg.roomLate;
   }
  }
 }
 // Tail has no hidden extension: fade over the final 20 ms of the project.
 for(let i=Math.max(0,n-Math.round(.02*sr));i<n;i++){const fade=(n-i)/(.02*sr);for(let c=0;c<2;c++){early[c][i]*=fade;late[c][i]*=fade;}}
 return {early,late};
}
