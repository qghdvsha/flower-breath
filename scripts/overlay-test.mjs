import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {landmarks} from '../tests/fixtures.ts';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5180/?testHarness=1');await page.waitForFunction(()=>window.__flowerTest?.state().resources.ready);
 const dock=page.getByRole('complementary',{name:'实时摄像头与手势识别'});
 assert.equal(await dock.isVisible(),false);
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'开启摄像头',exact:true}).click();await dock.waitFor();
 await page.waitForFunction(()=>window.__flowerTest.state().cameraFrames>2);
 async function feed(kind){await page.evaluate(h=>{clearInterval(window.overlayFeed);window.overlayFeed=setInterval(()=>window.__flowerTest.feed(h),10);},[{side:'Right',points:landmarks(kind,'Right',.65,.5)}]);}
 await feed('pair');await page.waitForFunction(()=>document.querySelector('.camera-status').textContent.includes('右手双指'));
 await page.waitForFunction(()=>{const c=document.querySelector('.camera-feed canvas'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return p.some((v,i)=>i%4===3&&v>0);});
 await page.screenshot({path:'test-results/browser/camera-overlay-pinch.png'});
 const bounds=await dock.boundingBox();assert.ok(bounds.width<1440*.25&&bounds.x+bounds.width>=1439&&bounds.y+bounds.height>=899);
 await feed('open');await page.waitForTimeout(350);await page.screenshot({path:'test-results/browser/camera-overlay-palm.png'});
 await page.evaluate(()=>{clearInterval(window.overlayFeed);window.__flowerTest.feed([]);});await page.waitForTimeout(500);
 assert.equal(await page.locator('.camera-feed canvas').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)),false);
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('checkbox',{name:'摄像头预览',exact:true}).uncheck();assert.equal(await dock.isVisible(),false);assert.equal(await page.locator('video').evaluate(v=>v.srcObject.getVideoTracks()[0].readyState),'live');
 await page.getByRole('checkbox',{name:'摄像头预览',exact:true}).check();await page.getByRole('button',{name:'关闭设置'}).click();
 await page.setViewportSize({width:390,height:844});await feed('pair');await page.waitForTimeout(400);await page.screenshot({path:'test-results/browser/camera-overlay-mobile.png'});assert.ok((await dock.boundingBox()).width<=170);
 await page.evaluate(()=>clearInterval(window.overlayFeed));await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'关闭摄像头',exact:true}).click();assert.equal(await dock.isVisible(),false);assert.equal(await page.locator('video').evaluate(v=>v.srcObject),null);
 assert.deepEqual(errors,[]);await writeFile('test-results/browser/overlay-report.json',JSON.stringify({defaultVisibleWithCamera:true,syntheticOverlay:true,staleCleared:true,hideKeepsInference:true,stopHides:true,mobile:true,errors,note:'Fake camera + synthetic landmarks; no real hardware alignment verification.'},null,2));console.log('Camera overlay checks passed.');
}finally{await browser.close();}
