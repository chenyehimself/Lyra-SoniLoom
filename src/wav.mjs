/** Owned RIFF/WAVE codec. No audio services or DSP dependencies. */
export function encodeWav(channels, sampleRate = 48000) {
  if (!Array.isArray(channels) || ![1,2].includes(channels.length) || !channels[0].length || channels.some(c => c.length !== channels[0].length)) throw Error('Invalid audio channels');
  const frames=channels[0].length, count=channels.length, buffer=new ArrayBuffer(44+frames*count*2), v=new DataView(buffer);
  const str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  str(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,count,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*count*2,true);v.setUint16(32,count*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,frames*count*2,true);
  for(let i=0;i<frames;i++)for(let c=0;c<count;c++){const x=channels[c][i];if(!Number.isFinite(x))throw Error('Nonfinite audio');v.setInt16(44+(i*count+c)*2,Math.max(-32768,Math.min(32767,Math.round(x*32768))),true);}
  return buffer;
}
export function decodeWav(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength<44 || buffer.byteLength>24*1024*1024) throw Error('WAV must be 44 bytes–24 MB');
  const v=new DataView(buffer), str=(o,n)=>String.fromCharCode(...new Uint8Array(buffer,o,n));
  if(str(0,4)!=='RIFF'||str(8,4)!=='WAVE')throw Error('Only little-endian RIFF WAV is supported');
  let fmt, data;
  for(let o=12;o+8<=v.byteLength;){const size=v.getUint32(o+4,true),start=o+8;if(start+size>v.byteLength)throw Error('Truncated WAV chunk');const tag=str(o,4);
    if(tag==='fmt '){if(size<16)throw Error('Invalid WAV format');fmt={format:v.getUint16(start,true),count:v.getUint16(start+2,true),rate:v.getUint32(start+4,true),align:v.getUint16(start+12,true),bits:v.getUint16(start+14,true)};}
    if(tag==='data')data={start,size};o=start+size+(size%2);
  }
  if(!fmt||!data)throw Error('WAV format/data missing');
  const {format,count,rate,align,bits}=fmt;
  if(![1,2].includes(count)||rate<8000||rate>192000||!([1].includes(format)&&[8,16,24,32].includes(bits)||format===3&&bits===32)||align!==count*bits/8)throw Error('Use mono/stereo PCM 8/16/24/32-bit or float32 WAV, 8–192 kHz');
  const frames=data.size/align;if(!Number.isInteger(frames)||frames<1||frames/rate>30)throw Error('WAV length must be greater than zero and at most 30 seconds');
  const channels=Array.from({length:count},()=>new Float32Array(frames));
  for(let i=0;i<frames;i++)for(let c=0;c<count;c++){
    const o=data.start+i*align+c*bits/8;let x;
    if(format===3)x=v.getFloat32(o,true);else if(bits===8)x=(v.getUint8(o)-128)/128;else if(bits===16)x=v.getInt16(o,true)/32768;else if(bits===24){let a=v.getUint8(o)|(v.getUint8(o+1)<<8)|(v.getUint8(o+2)<<16);if(a&0x800000)a-=0x1000000;x=a/8388608;}else x=v.getInt32(o,true)/2147483648;
    if(!Number.isFinite(x)||Math.abs(x)>4)throw Error('WAV contains invalid sample values');channels[c][i]=x;
  }
  return {sampleRate:rate,channels};
}
export function toBase64(buffer){const bytes=new Uint8Array(buffer);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export function fromBase64(s){if(typeof s!=='string'||s.length>34*1024*1024)throw Error('Invalid WAV asset');const b=atob(s);return Uint8Array.from(b,c=>c.charCodeAt(0)).buffer;}
export async function sha256(buffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(v=>v.toString(16).padStart(2,'0')).join('');}
