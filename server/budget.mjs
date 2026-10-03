import {readFileSync,openSync,writeSync,fsyncSync,closeSync,mkdirSync,rmdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

export const MODEL='gpt-6.1-sol';
const LEGACY_MODEL='gpt-5.4-mini-2026-03-17';
export const PRICES={input:2,output:10}; // USD / million tokens, official docs checked 2026-10-02.
export const RESERVE_CENTS=20, CAP_CENTS=500;
// Each request <=64 KiB JSON, output <=4096 tokens. $0.20 is deliberately
// above its byte-based input-token upper estimate plus maximum output cost.
// Reserves never refund: uncertain responses and process crashes remain counted.
export class Budget {
 constructor(path){this.path=path;}
 events(){
  let raw;try{raw=readFileSync(this.path,'utf8');}catch(e){if(e.code==='ENOENT')return [];throw Error('Budget ledger unavailable');}
  try{
   const events=raw.trim()?raw.trim().split('\n').map(line=>JSON.parse(line)):[];
   const ids=new Map(),settled=new Set();
   for(const e of events){
    if(e.type==='reserve'&&typeof e.id==='string'&&!ids.has(e.id)&&((e.cents===15&&e.model===LEGACY_MODEL)||(e.cents===RESERVE_CENTS&&e.model===MODEL)))ids.set(e.id,e.cents);
    else if(e.type==='usage'&&ids.has(e.id)&&!settled.has(e.id)&&Number.isFinite(e.usd)&&e.usd>=0&&e.usd<=ids.get(e.id)/100)settled.add(e.id);
    else throw Error();
   }
   return events;
  }catch{throw Error('Budget ledger is invalid; live calls disabled');}
 }
 status(){const events=this.events(),requests=events.filter(e=>e.type==='reserve').length,reservedCents=events.reduce((s,e)=>s+(e.type==='reserve'?e.cents:0),0);return {capUSD:5,requests,reservedUSD:reservedCents/100,remainingUSD:Math.max(0,(CAP_CENTS-reservedCents)/100),estimatedUSD:Number(events.reduce((s,e)=>s+(e.type==='usage'?e.usd:0),0).toFixed(8)),unsettled:requests-events.filter(e=>e.type==='usage').length};}
 append(event){const fd=openSync(this.path,'a',0o600);try{writeSync(fd,JSON.stringify(event)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
 locked(action){const lock=this.path+'.lock';try{mkdirSync(lock);}catch{throw Error('Budget ledger busy; request not sent');}try{return action();}finally{rmdirSync(lock);}}
 reserve(){return this.locked(()=>{const s=this.status();if(Math.round(s.reservedUSD*100)+RESERVE_CENTS>CAP_CENTS)throw Error('USD 5 test budget reached. No request sent.');const id=randomUUID();this.append({type:'reserve',id,cents:RESERVE_CENTS,at:new Date().toISOString(),model:MODEL});return id;});}
 settle(id,usage,responseId){
  const input=usage?.input_tokens,output=usage?.output_tokens;
  if(!Number.isSafeInteger(input)||input<0||!Number.isSafeInteger(output)||output<0)return;
  const reservation=this.events().find(e=>e.type==='reserve'&&e.id===id);if(!reservation)throw Error('Invalid budget settlement');
  const prices=reservation.model===LEGACY_MODEL?{input:.75,output:4.5}:PRICES;
  const usd=(input*prices.input+output*prices.output)/1e6;
  if(usd>reservation.cents/100)throw Error('Usage exceeded conservative reservation; stop testing');
  this.locked(()=>{const events=this.events();if(!events.some(e=>e.type==='reserve'&&e.id===id)||events.some(e=>e.type==='usage'&&e.id===id))throw Error('Invalid budget settlement');this.append({type:'usage',id,input,output,usd,responseId,at:new Date().toISOString()});});
 }
}
