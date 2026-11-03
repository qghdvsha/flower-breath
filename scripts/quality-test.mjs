import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {landmarks} from '../tests/fixtures.ts';

// Repeatable source-frame comparisons; synthetic input, not a camera test.
const label=process.argv[2]??'current';
assert.match(label,/^[a-z-]+$/);
const folder=`test-results/quality/${label}`;
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function feed(kind,amount=.5){
 await page.evaluate(h=>{clearInterval(window.feeder);window.feeder=setInterval(()=>window.__flowerTest.feed(h),40);window.__flowerTest.feed(h);},[{side:'Right',points:landmarks(kind,'Right',.65,amount)}]);
}
try{
 await page.goto('http://127.0.0.1:5180/?testHarness=1');
 await page.waitForFunction(()=>window.__flowerTest?.state().resources.ready);
 for(let index=0;index<5;index++){
  for(const amount of [.5,1]){
   await feed('pair',amount);await page.waitForTimeout(700);
   await page.waitForFunction(()=>window.__flowerTest.state().resources.ready);
   const png=await page.screenshot({path:`${folder}/flower-${index+1}-${amount===1?'open':'half'}.png`});
   const metrics=await page.evaluate(async data=>{
    const image=await createImageBitmap(await(await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas=new OffscreenCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);image.close();
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let luminance=0,white=0;
    for(let i=0;i<pixels.length;i+=4){luminance+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;if(Math.min(pixels[i],pixels[i+1],pixels[i+2])>=250)white++;}
    return {meanDisplayLuma:luminance/(pixels.length/4),nearWhiteFraction:white/(pixels.length/4)};
   },png.toString('base64'));
   results.push({index,amount,...metrics});
  }
  if(index<4){await feed('open');await page.waitForFunction(i=>{const s=window.__flowerTest.state();return s.index===i+1&&s.phase==='idle'&&s.resources.ready;},index);}
 }
 assert.deepEqual(errors,[]);
 await writeFile(`${folder}/report.json`,JSON.stringify({results,errors,note:'Synthetic stationary inputs at 720p. Brightness metrics do not measure recovered detail or camera performance.'},null,2));
 console.log(results);
}finally{await browser.close();}
