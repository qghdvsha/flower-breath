import {chromium} from '@playwright/test';import {readFile,mkdir,writeFile} from 'node:fs/promises';
const specs=JSON.parse(await readFile('scripts/hd-sources.json','utf8'));await mkdir('test-results/watermarks',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5180');
for(const s of specs){const result=await page.evaluate(async s=>{const v=document.createElement('video');v.src='/videos/hd/originals/'+s.file;v.muted=true;await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=j;});
 const c=document.createElement('canvas');c.width=1280;c.height=12*130;const ctx=c.getContext('2d');const times=Array.from({length:12},(_,i)=>Math.min(s.closed,s.open)+Math.abs(s.closed-s.open)*i/11);
 for(let i=0;i<times.length;i++){await new Promise(r=>{v.onseeked=r;v.currentTime=times[i];});ctx.drawImage(v,0,620,1280,100,0,i*130,1280,100);ctx.fillStyle='#000';ctx.fillRect(0,i*130+100,1280,30);ctx.fillStyle='white';ctx.font='18px sans-serif';ctx.fillText(times[i].toFixed(3),10,i*130+122);}
 return c.toDataURL('image/jpeg',.96).split(',')[1];},s);await writeFile(`test-results/watermarks/bottom-${s.id}.jpg`,Buffer.from(result,'base64'));}
}finally{await browser.close();}
