import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {landmarks} from '../tests/fixtures.ts';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const pair=(amount=1)=>({side:'Right',points:landmarks('pair','Right',.65,amount)}),left={side:'Left',points:landmarks('open','Left')},palm={side:'Right',points:landmarks('open','Right')};
async function feed(h){await page.evaluate(h=>{clearInterval(window.petalsFeed);window.petalsFeed=setInterval(()=>window.__flowerTest.feed(h),40);},h);}
try{await page.goto('http://127.0.0.1:5180/?testHarness=1');await page.waitForFunction(()=>window.__flowerTest?.state().resources.ready);
 for(const id of [1,3]){
  if(id===3)for(let n=0;n<2;n++){await feed([pair(.5)]);await page.waitForTimeout(300);await feed([palm]);await page.waitForFunction(i=>window.__flowerTest.state().index===i,n+1);}
  await feed([pair(),{side:'Left',points:landmarks('fist','Left')}]);await page.waitForTimeout(500);await feed([pair(),left]);
  await page.waitForFunction(()=>window.__flowerTest.state().resources.petals.mix>.95,null,{timeout:15000});
  await page.screenshot({path:`test-results/petals/play-${id}.png`});
  await page.waitForTimeout(3800);let s=await page.evaluate(()=>window.__flowerTest.state());assert.equal(s.resources.petals.playing,false);assert.ok(s.resources.petals.mix<.01);assert.equal(s.resources.petals.error,'');
  const bursts=s.petalBursts;await page.waitForTimeout(300);assert.equal((await page.evaluate(()=>window.__flowerTest.state())).petalBursts,bursts);
  await feed([pair(),{side:'Left',points:landmarks('fist','Left')}]);await page.waitForTimeout(250);await feed([pair(),left]);await page.waitForFunction(()=>window.__flowerTest.state().resources.petals.mix>.8);
  await feed([pair(0)]);await page.waitForTimeout(700);assert.ok((await page.evaluate(()=>window.__flowerTest.state())).resources.petals.mix<.01);
 }
 assert.deepEqual(errors,[]);await writeFile('test-results/petals/report.json',JSON.stringify({flowers:[1,3],nativePlayback:true,rearm:true,heldPalmNoRepeat:true,closeCancels:true,errors,note:'Synthetic landmarks in Chrome, not real-camera verification.'},null,2));console.log('Petal clip playback, repeat lock and cancellation passed.');
}catch(e){console.log(await page.evaluate(()=>window.__flowerTest?.state()),errors);throw e;}finally{await browser.close();}
