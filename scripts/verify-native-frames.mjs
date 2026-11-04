import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const p=await browser.newPage();await p.goto('http://127.0.0.1:5180');const checks=await p.evaluate(async()=>{
 const v=document.createElement('video');v.src='/videos/hd/originals/lily-final-a.mp4';
 await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=j;});
 const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d',{willReadFrequently:true}),results=[];
 for(const frame of [0,57,114]){await new Promise(r=>{v.onseeked=r;v.currentTime=.04+4.75*frame/114;});ctx.drawImage(v,0,0);const source=ctx.getImageData(0,0,c.width,c.height).data;
 const img=new Image();img.src='/videos/hd/frames-user-final/5/'+String(frame).padStart(3,'0')+'.png';await img.decode();ctx.drawImage(img,0,0);const exported=ctx.getImageData(0,0,c.width,c.height).data;
 let max=0,changed=0;for(let i=0;i<source.length;i++){const d=Math.abs(source[i]-exported[i]);max=Math.max(max,d);if(d)changed++;}results.push({frame,maxDifference:max,changedChannels:changed});
 }return results;});console.log(checks);for(const c of checks)assert.equal(c.maxDifference,0);await writeFile('test-results/final-videos/source-integrity.json',JSON.stringify(checks,null,2));
}finally{await browser.close();}
