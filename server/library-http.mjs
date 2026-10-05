import {MAX_MANIFEST} from '../src/library-contract.mjs';
async function body(req,limit=8192){let n=0;const chunks=[];for await(const ch of req){n+=ch.length;if(n>limit)throw Error('Request body too large');chunks.push(ch);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export function libraryHandler(library,{token,json,analysis,search}){return async(req,res,url)=>{
 if(!url.pathname.startsWith('/api/library/'))return false;
 if(req.headers['x-soniloom-token']!==token||(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==`http://${req.headers.host}`)){json(res,403,{error:'Use the local SoniLoom page for library access'});return true;}
 const route=url.pathname.slice('/api/library/'.length);
 try{
  let value;
  if(route==='settings'&&req.method==='GET')value=await library.settings();
  else if(route==='settings'&&req.method==='POST'){if(analysis?.active.size||analysis?.launching)throw Error('Cancel or finish the analysis batch before changing library roots');value=await library.configure((await body(req)).folder);}
  else if(route==='catalog'&&req.method==='GET')value=await library.catalog();
  else if(route==='manifest'&&req.method==='POST')value=await library.register(await body(req,MAX_MANIFEST));
  else if(route==='jobs'&&req.method==='POST')value=await library.createJob(await body(req));
  else if(route==='jobs'&&req.method==='GET')value={jobs:[...library.jobs.values()]};
  else if(/^jobs\/[a-f0-9-]+$/.test(route)&&req.method==='PUT')value=await library.upload(route.split('/')[1],req);
  else if(/^jobs\/[a-f0-9-]+\/cancel$/.test(route)&&req.method==='POST')value=library.cancel(route.split('/')[1]);
  else if(analysis&&route==='analysis/jobs'&&req.method==='POST')value=await analysis.createJob((await body(req)).refs);
  else if(analysis&&route==='analysis/jobs'&&req.method==='GET')value={jobs:await analysis.jobs()};
  else if(analysis&&/^analysis\/jobs\/[a-f0-9-]{36}\/(cancel|resume)$/.test(route)&&req.method==='POST'){const [, ,id,action]=route.split('/');value=action==='cancel'?analysis.cancel(id):await analysis.resume(id);}
  else if(analysis&&route==='analysis/record'&&req.method==='POST')value=await analysis.get(await body(req))||{record:null};
  else if(analysis&&route==='analysis/rebuild'&&req.method==='POST'){const index=await analysis.rebuild();value={snapshotId:index.snapshotId,total:index.entries.length,ready:index.entries.filter(e=>e.analysisStatus==='ready').length};}
  else if(search&&route==='search/start'&&req.method==='POST')value=await search.begin();
  else if(search&&route==='search'&&req.method==='POST'){const b=await body(req);value=await search.search(b.sessionId,b.query);}
  else if(search&&route==='search/clip'&&req.method==='POST'){const b=await body(req),clip=await search.clip(b.sessionId,b.candidateId);res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':clip.bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-SoniLoom-Source':JSON.stringify(clip.sourceRef)});res.end(clip.bytes);return true;}
  else if(route==='overview'&&req.method==='POST')value=await library.overview(await body(req));
  else if(route==='clip'&&req.method==='POST'){const b=await body(req),clip=await library.clip(b,b.firstFrame,b.endFrame);res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':clip.bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-SoniLoom-Source':JSON.stringify(clip.sourceRef)});res.end(clip.bytes);return true;}
  else{json(res,404,{error:'Unknown library operation'});return true;}
  json(res,200,value);
 }catch(e){if(!res.destroyed)json(res,422,{error:e.code==='ENOSPC'?'Not enough disk space':e.code==='EACCES'||e.code==='EPERM'?'Library folder permission denied':e.code==='ENOENT'?'Library file is missing; check the folder and installed volume':e.message});}
 return true;
 };}
