import {mountLibrary} from '../src/library.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
test('preview controls cannot discard a pending source overview',async t=>{
const originalDocument=globalThis.document,originalFetch=globalThis.fetch;t.after(()=>{globalThis.document=originalDocument;globalThis.fetch=originalFetch;});
for(const action of ['upgrade','stop','volume']){
const elements=new Map();const button={dataset:{result:'0'}};
function element(id){if(elements.has(id))return elements.get(id);const e={value:'',checked:false,hidden:false,disabled:false,open:false,textContent:'',options:[],addEventListener(){},showModal(){this.open=true},getContext(){return {clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillRect(){}}},querySelectorAll(){return id==='library-results'?[button]:[]},set innerHTML(v){this.html=v;if(id==='library-bundle')this.options=[{value:''},{value:'0'}]}};elements.set(id,e);return e;}
globalThis.document={getElementById:element};
const asset={bundleId:'b',version:'v',assetId:'a',variant:'original',name:'sound',source:'s',category:'c',subcategory:'x',tags:[],installed:true,kind:'audio',archive:'archives/a.zip',sha256:'a'.repeat(64)};
let done;const pending=new Promise(r=>done=r);
globalThis.fetch=async(url)=>({ok:true,json:async()=>url==='/api/status'?{clientToken:'t'}:url.endsWith('/catalog')?{entries:[asset],bundles:[{bundleId:'b',version:'v',archives:[]}]}:url.endsWith('/jobs')?{jobs:[]}:url.endsWith('/overview')?pending:{}});
mountLibrary({getStore:()=>({project:{schemaVersion:3,duration:9}}),onOpen(){},onAdd(){}});
await element('library-open').onclick();const selected=button.onclick();await new Promise(r=>setImmediate(r));
element('library-upgrade').checked=true;if(action==='upgrade')element('library-upgrade').oninput();if(action==='stop')element('library-stop').onclick();if(action==='volume')element('library-volume').oninput();
done({sampleRate:48000,frames:48000,duration:1,align:2,bits:16,channels:1,peaks:[0]});await selected;
assert.equal(element('library-in').disabled,false,'Successful overview must enable range even after schema checkbox input');
assert.equal(element('library-add').disabled,false,'Successful overview plus accepted schema must allow insertion');
}
});
