import {AnalysisStore} from './server/analysis-store.mjs';
import {LibrarySearch} from './server/library-search.mjs';
import {ArrangementService} from './server/arrangement.mjs';
import {Library} from './server/library.mjs';
import {libraryHandler} from './server/library-http.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {Budget} from './server/budget.mjs';
import {createAI} from './server/ai.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const port=Number(process.env.PORT||8795),clientToken=randomBytes(24).toString('hex');
let key=process.env.OPENAI_API_KEY||'';
if(!key){try{const env=await readFile(path.join(root,'.env.local'),'utf8');key=env.match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^\s"']+)/m)?.[1]||'';}catch{}}
if(process.env.SONILOOM_DISABLE_AI==='1')key='';
const ai=createAI({key,budget:new Budget(path.join(root,'work/ai-budget.jsonl'))});
const staticHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
const json=(res,status,data)=>{res.writeHead(status,{...staticHeaders,'Content-Type':'application/json'});res.end(JSON.stringify(data));};
const library=new Library(path.join(root,'work/library-settings.json')),analysis=new AnalysisStore(library),search=new LibrarySearch(library,analysis),arrangement=new ArrangementService(ai,search);
const handleLibrary=libraryHandler(library,{token:clientToken,json,analysis,search});
http.createServer(async(req,res)=>{
 try{
  const host=req.headers.host;if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host))return json(res,403,{error:'Local host required'});
  const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname);
  if(await handleLibrary(req,res,url))return;
  if(name==='/api/status'&&req.method==='GET')return json(res,200,{...ai.status(),clientToken});
  if(['/api/propose','/api/arrange'].includes(name)&&req.method==='POST'){
   if(req.headers.origin!==`http://${host}`||req.headers['x-soniloom-token']!==clientToken||req.headers['content-type']!=='application/json')return json(res,403,{error:'Use the local SoniLoom page to send AI requests'});
   let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>100*1024){json(res,413,{error:'Request too large; no API call sent'});return;}chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return json(res,400,{error:'Invalid request JSON'});}
   const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
   try{return json(res,200,await (name==='/api/arrange'?arrangement.generate(body,{signal:controller.signal}):ai.generate(body,{signal:controller.signal})));}catch(e){return json(res,422,{error:e.message});}
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  if(!(name==='/'||name==='/index.html'||name==='/styles.css'||name==='/favicon.svg'||/^\/src\/[a-z-]+\.mjs$/.test(name))){res.writeHead(404);return res.end('Not found');}
  const file=path.join(root,name==='/'?'index.html':name.slice(1));const bytes=await readFile(file);
  res.writeHead(200,{...staticHeaders,'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{json(res,500,{error:'Local service unavailable. Check server and budget ledger; no automatic retry.'});}
}).listen(port,'127.0.0.1',()=>console.log(`Lyra SoniLoom v0.5 → http://127.0.0.1:${port}`));
