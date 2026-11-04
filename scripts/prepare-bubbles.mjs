import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5180');await page.evaluate(async()=>{const v=document.createElement('video');v.src='/videos/hd/originals/lily-final-a.mp4';await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=j;});window.sourceVideo=v;});
 const framePath='/videos/hd/frames-user-final/5',frames=115;await mkdir('public'+framePath,{recursive:true});
 for(let frame=0;frame<frames;frame++){
  const png=await page.evaluate(async frame=>{const v=window.sourceVideo;await new Promise(r=>{v.onseeked=r;v.currentTime=.04+4.75*frame/114;});const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c.toDataURL('image/png').split(',')[1];},frame);
  await writeFile('public'+framePath+'/'+String(frame).padStart(3,'0')+'.png',Buffer.from(png,'base64'));
 }
 const clips=JSON.parse(await readFile('public/videos/hd/lily-final-sources.json','utf8'));
 const meta={...clips[0],id:5},manifest=JSON.parse(await readFile('public/videos/manifest.json','utf8'));
 manifest[4]={id:5,file:meta.file,name:'浮光百合',closed:.04,open:4.79,color:'#efc5dc',original:meta.original,framePath,frameExtension:'png',frames,width:meta.width,height:meta.height,duration:meta.duration,fps:24,effectVideo:clips[1].original,processing:'User supplied clean video, complete unmodified PNG frames; separate original dynamic bubble video.'};
 for(const p of ['public/videos/manifest.json','public/videos/hd/manifest.json'])await writeFile(p,JSON.stringify(manifest,null,2));
 const metadata=JSON.parse(await readFile('public/videos/hd/source-metadata.json','utf8'));metadata[4]=meta;await writeFile('public/videos/hd/source-metadata.json',JSON.stringify(metadata,null,2));
 await writeFile('public/videos/hd/lily-final-sources.json',JSON.stringify(clips,null,2));console.log('User clean video prepared; dynamic bubble video preserved intact.');
}finally{await browser.close();}
