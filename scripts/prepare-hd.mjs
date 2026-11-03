import {repairWatermark} from './watermark-repair.mjs';
import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const sources=JSON.parse(await readFile('scripts/hd-sources.json','utf8'));
const metadata=JSON.parse(await readFile('test-results/hd-inspection/metadata.json','utf8'));
const manifest=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5180');await page.evaluate('window.repairWatermark = '+repairWatermark.toString());
for(const source of sources){
 const meta=metadata.find(m=>m.id===source.id),framePath=`/videos/hd/frames-v3/${source.id}`;
 await mkdir('public'+framePath,{recursive:true});
 await page.evaluate(async src=>{
  const v=document.createElement('video');v.muted=true;v.src=src;
  await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=()=>j(new Error(v.error?.message));});
  window.sourceVideo=v;
 },meta.original);
 const count=Math.round(Math.abs(source.open-source.closed)*24)+1;
 for(let i=0;i<count;i++){
  const time=source.closed+(source.open-source.closed)*i/(count-1);
  const encoded=await page.evaluate(async({time,id})=>{
   const v=window.sourceVideo;await new Promise(r=>{v.onseeked=r;v.currentTime=time;});
   const c=document.createElement('canvas'),w=c.width=v.videoWidth,h=c.height=v.videoHeight;
   const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(v,0,0);
   const current=ctx.getImageData(0,0,w,h),p=current.data;
   // Expanded coverage includes the animated entrance and trailing glow.
   // Clip 4 uses the equivalent reverse segment with its watermark over empty sky.
   const region=id===4?[0,8,278,110]:[1020,610,1280,718];
   window.repairWatermark(p,w,h,region);
   const original=new Uint8ClampedArray(p);for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const k=(y*w+x)*4;for(let ch=0;ch<3;ch++){const blur=(original[k-4+ch]+original[k+4+ch]+original[k-w*4+ch]+original[k+w*4+ch])/4;p[k+ch]=original[k+ch]+Math.max(-6,Math.min(6,(original[k+ch]-blur)*.28));}}
   ctx.putImageData(current,0,0);return c.toDataURL('image/jpeg',.94).split(',')[1];
  },{time,id:source.id});
  await writeFile(`public${framePath}/${String(i).padStart(3,'0')}.jpg`,Buffer.from(encoded,'base64'));
 }
 manifest.push({...source,original:meta.original,framePath,frames:count,width:meta.width,height:meta.height,duration:meta.duration,fps:24,watermarkRepair:{method:'same-frame spatial background reconstruction; no static donor',region:source.id===4?[0,8,278,110]:[1020,610,1280,718]}});
 console.log(source.id,source.name,count,`${meta.width}x${meta.height}`);
}
await writeFile('public/videos/hd/manifest.json',JSON.stringify(manifest,null,2));
await copyFile('test-results/hd-inspection/metadata.json','public/videos/hd/source-metadata.json');
await copyFile('public/videos/hd/manifest.json','public/videos/manifest.json');
console.log('All five assets prepared; live manifest updated.');
}finally{await browser.close();}
