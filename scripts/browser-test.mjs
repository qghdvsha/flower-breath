import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {landmarks} from '../tests/fixtures.ts';
await mkdir('test-results/browser',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('INFO: Created TensorFlow Lite XNNPACK delegate'))errors.push(m.text()+" at "+m.location().url);});const report={snapshots:[],cycles:[]};
try{
 await page.goto('http://127.0.0.1:5180/?testHarness=1');await page.waitForFunction(()=>window.__flowerTest?.state().resources.ready);
 const state=()=>page.evaluate(()=>window.__flowerTest.state());
 function raw(opening=.5,leftX){const a=[{side:'Right',points:landmarks(opening===0?'pinch':'pair','Right',.65,opening)}];if(leftX!==undefined)a.push({side:'Left',points:landmarks('open','Left').map(p=>({...p,x:p.x+leftX-.5}))});return a;}
 async function feed(opening=.5,leftX){await page.evaluate(h=>{clearInterval(window.feeder);window.feeder=setInterval(()=>window.__flowerTest.feed(h),40);window.__flowerTest.feed(h);},raw(opening,leftX));}
 async function settled(){await page.waitForFunction(()=>{const s=window.__flowerTest.state();return s.resources.ready&&s.phase==='idle';});await page.waitForTimeout(150);}
 await feed(0);await page.waitForFunction(()=>window.__flowerTest.state().aperture<.002);await settled();await page.screenshot({path:'test-results/browser/closed.png'});
 await feed(1);await page.waitForFunction(()=>window.__flowerTest.state().aperture>.998);await settled();await page.screenshot({path:'test-results/browser/open.png'});
 for(const a of [.2,.8,.1,1,0,.5]){await feed(a);await page.waitForTimeout(100);}await page.waitForTimeout(700);await settled();const half=await state();assert.ok(half.aperture>.2&&half.aperture<.8);
 await page.evaluate(()=>{clearInterval(window.feeder);window.__flowerTest.feed([]);});await page.waitForTimeout(800);assert.ok(Math.abs((await state()).aperture-half.aperture)<.002);
 async function openPalm(){await page.evaluate(h=>{clearInterval(window.feeder);window.feeder=setInterval(()=>window.__flowerTest.feed(h),40);window.__flowerTest.feed(h);},[{side:'Right',points:landmarks('open','Right')}]);}

 for(let cycle=0;cycle<12;cycle++){
  const before=await state();await openPalm();await page.waitForFunction(index=>{const s=window.__flowerTest.state();return s.next!==index||s.index!==index;},before.index);
  if(cycle===0){await page.waitForTimeout(220);await page.screenshot({path:'test-results/browser/transition.png'});}
  await page.waitForFunction(index=>window.__flowerTest.state().index===(index+1)%5,before.index);await settled();const after=await state();assert.equal(after.switches,before.switches+1);await page.waitForTimeout(350);assert.equal((await state()).switches,after.switches);assert.ok(Math.abs(after.aperture-half.aperture)<.002);
  assert.ok(after.resources.decoded<=24);assert.ok(after.resources.inFlight<=3);assert.equal(after.legacy,null);report.cycles.push(after.resources);
  if(cycle<5){await feed(1);await page.waitForTimeout(600);await settled();await page.screenshot({path:`test-results/browser/flower-${after.index+1}.png`});await feed(.5);await page.waitForTimeout(400);}
  await feed(.5);await page.waitForTimeout(350);
 }
 const resources=report.cycles.map(s=>s.textures);assert.ok(Math.max(...resources)-Math.min(...resources)<=1);
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByLabel('体验模式').selectOption('legacy');await page.waitForFunction(()=>window.__flowerTest?.state().mode==='legacy');
 await page.evaluate(h=>{clearInterval(window.feeder);window.feeder=setInterval(()=>window.__flowerTest.feed(h),40);},[{side:'Left',points:landmarks('index')}]);await page.waitForFunction(()=>window.__flowerTest.state().legacy==='butterfly');
 await page.getByLabel('体验模式').selectOption('breath');await page.waitForFunction(()=>window.__flowerTest?.state().mode==='breath');await feed(.5);await settled();
 await page.getByRole('button',{name:'重置',exact:true}).click();assert.equal((await state()).index,0);await page.getByRole('button',{name:'关闭设置'}).click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:'test-results/browser/mobile.png'});
 await page.evaluate(()=>clearInterval(window.feeder));await page.goto('http://127.0.0.1:5180/?testHarness=1');await page.waitForFunction(()=>window.__flowerTest?.state().resources.ready);
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'开启摄像头',exact:true}).click();await page.waitForFunction(()=>window.__flowerTest.state().cameraFrames>2,null,{timeout:60000});
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.evaluate(()=>{window.tracks=[...document.querySelector('video').srcObject.getTracks()];});await page.getByRole('button',{name:'关闭摄像头',exact:true}).click();assert.ok(await page.evaluate(()=>window.tracks.every(t=>t.readyState==='ended')&&document.querySelector('video').srcObject===null));
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError');};});await page.getByRole('button',{name:'开启摄像头',exact:true}).click();await page.getByRole('alert').filter({hasText:'摄像头权限被拒绝'}).waitFor();
 report.camera='Fake-video inference in local Worker, track release and permission-denial UI passed; no real hardware gestures tested.';report.errors=errors;await writeFile('test-results/browser/report.json',JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log('Flower Breath browser checks passed: 12 switches, bounded frame cache, gesture lanes, original mode, fake camera lifecycle.');
}catch(e){await page.screenshot({path:'test-results/browser/failure.png'});console.log(await page.locator('body').innerText());console.log(errors);throw e;}finally{await browser.close();}
