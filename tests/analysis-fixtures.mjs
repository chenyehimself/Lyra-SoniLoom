import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Library} from '../server/library.mjs';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export async function installedFixture(){
 const dir=await mkdtemp(path.join(tmpdir(),'soniloom-intelligence-')),lib=new Library(path.join(dir,'config.json'),path.join(dir,'content'));await lib.init();
 const bytes=Buffer.alloc(44+8000*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(16000,40);for(let i=800;i<3200;i++)bytes.writeInt16LE(i%2?8192:-8192,44+i*2);
 const assets=['Pistol Single Shot','Metal Door','Pistol Alternate'].map((name,i)=>({asset_id:`asset-${i}`,variant:'original',source_collection:'team',display_name:name,category:i===1?'Doors':'Weapons',subcategory:i===1?'Metal':'Pistol',tags:i===1?['door']:['pistol','shot'],path:`assets/${i}.wav`,kind:'audio',sha256:hash(bytes),audio:{bytes:bytes.length,frames:8000,sample_rate:8000,channels:1},archive:'archives/test.zip'}));
 const catalog={format:'lyra-internal-asset-distribution',format_version:1,bundle_id:'team-test',bundle_version:'0.1.0',assets,derivatives:[],archives:[{path:'archives/test.zip',archive_bytes:22,uncompressed_media_bytes:bytes.length*3,media_files:3,sha256:'b'.repeat(64)}]};await lib.register(catalog);
 const volume=path.join(lib.root,'bundles/team-test/0.1.0/volumes','b'.repeat(64));await mkdir(path.join(volume,'assets'),{recursive:true});await writeFile(path.join(volume,'installed.json'),'{}');for(let i=0;i<3;i++)await writeFile(path.join(volume,`assets/${i}.wav`),bytes);
 const entries=(await lib.catalog()).entries;return {dir,lib,bytes,entries,volume};
}
