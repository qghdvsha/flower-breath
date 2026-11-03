import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
function metadata(b){const tracks=[];function scan(start,end,track){for(let p=start;p+8<=end;){let n=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);if(n<8||p+n>end)break;let t=track;if(type==='trak'){t={};tracks.push(t);}if(['moov','trak','mdia','minf','stbl'].includes(type))scan(p+8,p+n,t);if(type==='hdlr'&&t)t.handler=b.toString('ascii',p+16,p+20);if(type==='mdhd'&&t){const v=b[p+8];t.timescale=b.readUInt32BE(p+(v?28:20));t.duration=Number(v?b.readBigUInt64BE(p+32):b.readUInt32BE(p+24))/t.timescale;}if(type==='stts'&&t){let count=0,ticks=0;for(let j=0;j<b.readUInt32BE(p+12);j++){const k=p+16+j*8,c=b.readUInt32BE(k);count+=c;ticks+=c*b.readUInt32BE(k+4);}t.samples=count;t.fps=count*t.timescale/ticks;}p+=n;}}scan(0,b.length);return tracks;}
await mkdir('test-results/inspection',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:5180');const results=[];
for(let i=1;i<=4;i++){
 const raw=await readFile('public/videos/originals/flower-'+i+'.mp4');
 const result=await page.evaluate(async i=>{
  const v=document.createElement('video');v.muted=true;v.src='/videos/originals/flower-'+i+'.mp4';await new Promise((resolve,reject)=>{v.onloadedmetadata=resolve;v.onerror=reject;});
  const c=document.createElement('canvas');c.width=1200;c.height=720;const ctx=c.getContext('2d');ctx.fillStyle='#080b12';ctx.fillRect(0,0,c.width,c.height);
  for(let j=0;j<12;j++){const time=.08+j*(v.duration-.16)/11;await new Promise(resolve=>{v.onseeked=resolve;v.currentTime=time;});const x=j%4*300,y=Math.floor(j/4)*240;ctx.drawImage(v,x,y,300,208);ctx.fillStyle='white';ctx.font='15px sans-serif';ctx.fillText(time.toFixed(2)+' s',x+8,y+230);}
  return {width:v.videoWidth,height:v.videoHeight,duration:v.duration,sheet:c.toDataURL('image/jpeg',.92)};
 },i);
 await writeFile('test-results/inspection/flower-'+i+'.jpg',Buffer.from(result.sheet.split(',')[1],'base64'));delete result.sheet;
 results.push({id:i,...result,tracks:metadata(raw),sha256:createHash('sha256').update(raw).digest('hex')});
}await writeFile('test-results/inspection/metadata.json',JSON.stringify(results,null,2));await writeFile('public/videos/source-metadata.json',JSON.stringify(results,null,2));console.log(results);await browser.close();
