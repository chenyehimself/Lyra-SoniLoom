import {readFileSync,openSync,writeSync,fsyncSync,closeSync,mkdirSync,rmdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

export const MODEL='gpt-5.4-mini-2026-03-17';
export const PRICES={input:0.75,output:4.5}; // USD / million tokens, official docs checked 2026-10-02.
export const RESERVE_CENTS=15, CAP_CENTS=500;
// Each request <=64 KiB JSON, output <=4096 tokens. $0.15 is deliberately
// above its byte-based input-token upper estimate plus maximum output cost.
// Reserves never refund: uncertain responses and process crashes remain counted.
export class Budget {
 constructor(path){this.path=path;}
 events(){
  let raw;try{raw=readFileSync(this.path,'utf8');}catch(e){if(e.code==='ENOENT')return [];throw Error('Budget ledger unavailable');}
  try{
   const events=raw.trim()?raw.trim().split('\n').map(line=>JSON.parse(line)):[];
   const ids=new Set(),settled=new Set();
   for(const e of events){
    if(e.type==='reserve'&&typeof e.id==='string'&&!ids.has(e.id)&&e.cents===RESERVE_CENTS)ids.add(e.id);
    else if(e.type==='usage'&&ids.has(e.id)&&!settled.has(e.id)&&Number.isFinite(e.usd)&&e.usd>=0&&e.usd<=RESERVE_CENTS/100)settled.add(e.id);
    else throw Error();
   }
   return events;
  }catch{throw Error('Budget ledger is invalid; live calls disabled');}
 }
 status(){const events=this.events(),requests=events.filter(e=>e.type==='reserve').length;return {capUSD:5,requests,reservedUSD:requests*RESERVE_CENTS/100,remainingUSD:Math.max(0,(CAP_CENTS-requests*RESERVE_CENTS)/100),estimatedUSD:Number(events.reduce((s,e)=>s+(e.type==='usage'?e.usd:0),0).toFixed(8)),unsettled:requests-events.filter(e=>e.type==='usage').length};}
 append(event){const fd=openSync(this.path,'a',0o600);try{writeSync(fd,JSON.stringify(event)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
 locked(action){const lock=this.path+'.lock';try{mkdirSync(lock);}catch{throw Error('Budget ledger busy; request not sent');}try{return action();}finally{rmdirSync(lock);}}
 reserve(){return this.locked(()=>{const s=this.status();if(s.requests*RESERVE_CENTS+RESERVE_CENTS>CAP_CENTS)throw Error('USD 5 test budget reached. No request sent.');const id=randomUUID();this.append({type:'reserve',id,cents:RESERVE_CENTS,at:new Date().toISOString(),model:MODEL});return id;});}
 settle(id,usage,responseId){
  const input=usage?.input_tokens,output=usage?.output_tokens;
  if(!Number.isSafeInteger(input)||input<0||!Number.isSafeInteger(output)||output<0)return;
  const usd=(input*PRICES.input+output*PRICES.output)/1e6;
  if(usd>RESERVE_CENTS/100)throw Error('Usage exceeded conservative reservation; stop testing');
  this.locked(()=>{const events=this.events();if(!events.some(e=>e.type==='reserve'&&e.id===id)||events.some(e=>e.type==='usage'&&e.id===id))throw Error('Invalid budget settlement');this.append({type:'usage',id,input,output,usd,responseId,at:new Date().toISOString()});});
 }
}
