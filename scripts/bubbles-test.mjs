import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {landmarks} from '../tests/fixtures.ts';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const hand=(pose,side='Right',amount=1)=>({side,points:landmarks(pose,side,.65,amount)}),state=()=>page.evaluate(()=>window.__flowerTest.state());
async function feed(h){await page.evaluate(h=>{clearInterval(window.bubbleFeed);window.bubbleFeed=setInterval(()=>window.__flowerTest.feed(h),40);},h);}
async function toFifth(){for(let i=1;i<=4;i++){await feed([hand('pair','Right',.5)]);await page.waitForTimeout(300);await feed([hand('open')]);await page.waitForFunction(i=>window.__flowerTest.state().index===i,i);}}
try{
 await page.goto('http://127.0.0.1:5180/?testHarness=1');await page.waitForFunction(()=>window.__flowerTest?.state().resources.ready);
 await toFifth();await feed([hand('pair')]);await page.waitForTimeout(1000);
 assert.equal((await state()).resources.bubbles.active,false);await page.screenshot({path:'test-results/final-videos/default.png'});
 await feed([hand('pair'),hand('open','Left')]);await page.waitForFunction(()=>window.__flowerTest.state().resources.bubbles.mix>.99);
 const first=await state();await page.screenshot({path:'test-results/final-videos/play-1.png'});await page.waitForTimeout(1400);
 const second=await state();await page.screenshot({path:'test-results/final-videos/play-2.png'});
 assert.ok(second.resources.bubbles.time-first.resources.bubbles.time>1);assert.ok(second.resources.bubbles.presentedFrames-first.resources.bubbles.presentedFrames>12);
 assert.ok(Math.abs(second.aperture-first.aperture)<.001);assert.equal(second.resources.bubbles.source,'user-dynamic-video');
 await page.waitForFunction(()=>window.__flowerTest.state().resources.bubbles.time>4.5);
 assert.equal((await state()).resources.bubbles.playing,true);
 await page.waitForFunction(()=>!window.__flowerTest.state().resources.bubbles.playing&&window.__flowerTest.state().resources.bubbles.mix<.001);
 assert.ok((await state()).resources.bubbles.time>5.8);const bursts=(await state()).bubbleBursts;
 await page.waitForTimeout(350);assert.equal((await state()).bubbleBursts,bursts);assert.equal((await state()).resources.bubbles.playing,false);
 await feed([hand('pair'),hand('fist','Left')]);await page.waitForTimeout(250);await feed([hand('pair'),hand('open','Left')]);
 await page.waitForFunction(()=>window.__flowerTest.state().resources.bubbles.mix>.99);
 await feed([hand('pair','Right',.2),hand('fist','Left')]);await page.waitForTimeout(700);
 let s=await state();assert.equal(s.resources.bubbles.active,false);assert.ok(s.aperture<.3);await page.screenshot({path:'test-results/final-videos/released.png'});
 await feed([hand('pair'),hand('open','Left')]);await page.waitForFunction(()=>window.__flowerTest.state().resources.bubbles.playing);
 await feed([hand('open'),hand('open','Left')]);await page.waitForFunction(()=>window.__flowerTest.state().index===0);assert.equal((await state()).resources.bubbles.active,false);
 await toFifth();await page.waitForTimeout(400);s=await state();assert.equal(s.resources.bubbles.active,false);assert.ok(s.resources.decoded<=24);
 assert.deepEqual(errors,[]);
 await writeFile('test-results/final-videos/browser-report.json',JSON.stringify({videoTimeAdvance:second.resources.bubbles.time-first.resources.bubbles.time,presentedFrameAdvance:second.resources.bubbles.presentedFrames-first.resources.bubbles.presentedFrames,rightHandHeldStill:true,fullSixSeconds:true,releaseReturnsToCurrentAperture:true,heldPalmDoesNotReplay:true,reentryNoStaleEffect:true,errors,note:'Chrome synthetic hands; no real camera verification.'},null,2));
 console.log('Native bubble video advances while right hand is stationary; full playback, release, replay and reentry passed.');
}catch(e){console.log(await state(),errors);throw e;}finally{await browser.close();}
