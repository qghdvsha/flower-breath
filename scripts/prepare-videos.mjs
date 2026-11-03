import {chromium} from '@playwright/test';import {writeFile,mkdir} from 'node:fs/promises';
const specs=[{id:1,name:'月下樱',closed:.042,open:2.5,color:'#b9dfff'},{id:2,name:'晚风木槿',closed:2.25,open:.042,color:'#f2bed4'},{id:3,name:'蓝夜微光',closed:2.25,open:.042,color:'#5ea7ff'},{id:4,name:'风铃花语',closed:.042,open:2.7,color:'#f1c4d1'}];
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:5180');
for(const spec of specs){
 await mkdir('public/videos/frames/'+spec.id,{recursive:true});
 await page.evaluate(async spec=>{const v=document.createElement('video');v.muted=true;v.src='/videos/originals/flower-'+spec.id+'.mp4';await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=j;});await new Promise(r=>{v.onseeked=r;v.currentTime=.001;});
 const clean=document.createElement('canvas');clean.width=1280;clean.height=720;clean.getContext('2d').drawImage(v,0,0);window.sourceVideo=v;window.cleanFrame=clean;},spec);
 const count=Math.round(Math.abs(spec.open-spec.closed)*24)+1;
 for(let i=0;i<count;i++){
  const encoded=await page.evaluate(async({time,index})=>{const v=window.sourceVideo;await new Promise(r=>{v.onseeked=r;v.currentTime=time;});const c=document.createElement('canvas');c.width=1280;c.height=720;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(v,0,0);
   // Stamp only the small watermark rectangle from the clean first frame, with feathered edges.
   const current=ctx.getImageData(0,0,1280,720),ref=window.cleanFrame.getContext('2d').getImageData(0,0,1280,720);const p=current.data;
   for(let y=632;y<706;y++)for(let x=1045;x<1272;x++){const fade=Math.min(1,(x-1045)/10,(1272-x)/8,(y-632)/10,(706-y)/8);const k=(y*1280+x)*4;for(let ch=0;ch<3;ch++)p[k+ch]=p[k+ch]*(1-fade)+ref.data[k+ch]*fade;}
   // Mild bounded unsharp: no upscaling, no fabricated detail, cap correction to 6/255.
   const original=new Uint8ClampedArray(p);for(let y=1;y<719;y++)for(let x=1;x<1279;x++){const k=(y*1280+x)*4;for(let ch=0;ch<3;ch++){const blur=(original[k-4+ch]+original[k+4+ch]+original[k-5120+ch]+original[k+5120+ch])/4;const delta=Math.max(-6,Math.min(6,(original[k+ch]-blur)*.28));p[k+ch]=original[k+ch]+delta;}}
   ctx.putImageData(current,0,0);return c.toDataURL('image/jpeg',.94).split(',')[1];
  },{time:spec.closed+(spec.open-spec.closed)*i/(count-1),index:i});
  await writeFile(`public/videos/frames/${spec.id}/${String(i).padStart(3,'0')}.jpg`,Buffer.from(encoded,'base64'));
 }
 spec.frames=count;spec.width=1280;spec.height=720;spec.duration=8.062993;spec.fps=24;spec.watermarkRepair={sourceTime:.001,rect:[1045,632,227,74],method:'clean first-frame patch, feathered; not recovered hidden detail'};
 console.log(spec.name,count,'frames saved');
}
await writeFile('public/videos/manifest.json',JSON.stringify(specs,null,2));await browser.close();
