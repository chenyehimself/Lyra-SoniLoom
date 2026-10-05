/** Distribution v1 adapter. Metadata is descriptive; hashes pin bytes, not publisher identity. */
export const MAX_MANIFEST=20*1024*1024;
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const safeId=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(x)&&x!=='.'&&x!=='..';
export const safePath=x=>typeof x==='string'&&x.length<500&&!x.includes('\\')&&x.split('/').every(p=>p.length<=255&&/^[a-zA-Z0-9][a-zA-Z0-9._ -]*$/.test(p)&&p!=='.'&&p!=='..');
const integer=x=>Number.isSafeInteger(x)&&x>=0;
export function validateCatalog(c){
 if(c?.format!=='lyra-internal-asset-distribution'||c.format_version!==1||!safeId(c.bundle_id)||!safeId(c.bundle_version))throw Error('Unsupported distribution manifest');
 if(!Array.isArray(c.assets)||!Array.isArray(c.derivatives)||!Array.isArray(c.archives)||c.assets.length+c.derivatives.length>20000||c.archives.length>1000)throw Error('Invalid catalog size');
 const archives=new Map(),seen=new Set(),paths=new Set();
 for(const a of c.archives){if(!safePath(a.path)||!a.path.startsWith('archives/')||archives.has(a.path)||!hash(a.sha256)||!integer(a.archive_bytes)||a.archive_bytes<22||a.archive_bytes>16*1024**3||!integer(a.uncompressed_media_bytes)||a.uncompressed_media_bytes>32*1024**3||!integer(a.media_files))throw Error('Invalid archive declaration');archives.set(a.path,{...a,count:0,bytes:0,unknown:0});}
 for(const a of [...c.assets,...c.derivatives]){const key=`${a.asset_id}:${a.variant}`,ar=archives.get(a.archive);if(!safeId(a.asset_id)||!safeId(a.variant)||!safeId(a.source_collection)||!hash(a.sha256)||!safePath(a.path)||['pack-manifest.json','installed.json'].includes(a.path.split('/')[0].toLowerCase())||!ar||seen.has(key)||paths.has(`${a.archive}:${a.path}`)||!['audio','midi'].includes(a.kind))throw Error('Invalid or duplicate asset');
  for(const k of ['display_name','category','subcategory'])if(typeof a[k]!=='string'||a[k].length>300)throw Error('Invalid asset label');
  if(a.tags!==undefined&&(!Array.isArray(a.tags)||a.tags.length>100||a.tags.some(t=>typeof t!=='string'||t.length>100)))throw Error('Invalid tags');
  const bytes=a.audio?.bytes??a.bytes;if(a.kind==='midi'&&bytes===undefined)ar.unknown++;else{if(!integer(bytes)||bytes<1)throw Error('Invalid source byte count');ar.bytes+=bytes;}ar.count++;seen.add(key);paths.add(`${a.archive}:${a.path}`);
 }
 for(const a of archives.values())if((a.unknown?a.bytes>=a.uncompressed_media_bytes:a.bytes!==a.uncompressed_media_bytes)||a.count!==a.media_files)throw Error('Archive content totals do not match');
 return c;
}
export function validateSourceRef(r,assetId,decoded){
 const keys=['bundleId','bundleVersion','assetId','variant','sourceSha256','embeddedSha256','firstFrame','endFrame','sourceSampleRate'];
 if(!r||Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k))||!['bundleId','bundleVersion','assetId','variant'].every(k=>safeId(r[k]))||!hash(r.sourceSha256)||r.embeddedSha256!==assetId||!integer(r.firstFrame)||!integer(r.endFrame)||r.endFrame<=r.firstFrame||r.sourceSampleRate!==decoded.sampleRate||r.endFrame-r.firstFrame!==decoded.channels[0].length)throw Error('Invalid library source reference');
}
