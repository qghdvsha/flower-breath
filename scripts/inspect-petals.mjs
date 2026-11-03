import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const specs=[{id:1,file:'flower-1.MOV'},{id:3,file:'flower-3.MOV'}];
function metadata(b){const tracks=[];function scan(start,end,track){for(let p=start;p+8<=end;){let n=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);if(n<8||p+n>end)break;let t=track;if(type==='trak'){t={};tracks.push(t);}if(['moov','trak','mdia','minf','stbl'].includes(type))scan(p+8,p+n,t);if(type==='hdlr'&&t&&!t.handler)t.handler=b.toString('ascii',p+16,p+20);if(type==='mdhd'&&t){const v=b[p+8];t.timescale=b.readUInt32BE(p+(v?28:20));t.duration=Number(v?b.readBigUInt64BE(p+32):b.readUInt32BE(p+24))/t.timescale;}if(type==='stsd'&&t)t.codec=b.toString('ascii',p+20,p+24);if(type==='stts'&&t){let count=0,ticks=0;for(let j=0;j<b.readUInt32BE(p+12);j++){const k=p+16+j*8,c=b.readUInt32BE(k);count+=c;ticks+=c*b.readUInt32BE(k+4);}t.samples=count;t.fps=count*t.timescale/ticks;}p+=n;}}scan(0,b.length);return tracks;}
await mkdir('test-results/petals',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5180');const results=[];
for(const spec of specs){
 const original=`/videos/petals/originals/${spec.file}`,raw=await readFile('public'+original);
 const result=await page.evaluate(async src=>{
  const v=document.createElement('video');v.muted=true;v.src=src;
  await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=()=>j(new Error('Video decode failed: '+v.error?.message));setTimeout(()=>j(new Error('Decode timeout')),15000);});
  const c=document.createElement('canvas');c.width=1280;c.height=800;const ctx=c.getContext('2d');ctx.fillStyle='#080b12';ctx.fillRect(0,0,c.width,c.height);
  for(let j=0;j<16;j++){const time=.02+j*(v.duration-.08)/15;await new Promise(r=>{v.onseeked=r;v.currentTime=time;});const x=j%4*320,y=Math.floor(j/4)*200;ctx.drawImage(v,x,y,320,180);ctx.fillStyle='white';ctx.font='15px sans-serif';ctx.fillText(time.toFixed(3)+' s',x+8,y+196);}
  return {width:v.videoWidth,height:v.videoHeight,duration:v.duration,sheet:c.toDataURL('image/jpeg',.95)};
 },original);
 await writeFile(`test-results/petals/flower-${spec.id}.jpg`,Buffer.from(result.sheet.split(',')[1],'base64'));delete result.sheet;
 results.push({...spec,original,...result,tracks:metadata(raw),sha256:createHash('sha256').update(raw).digest('hex')});
 console.log(results.at(-1));
}await writeFile('test-results/petals/metadata.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
