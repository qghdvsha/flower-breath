import {test} from 'node:test';import assert from 'node:assert/strict';import {fitCamera} from '../src/hand-overlay.ts';
test('camera overlay fits native 4:3 and letterboxed 16:9 without stretching or a second mirror',()=>{
 assert.deepEqual(fitCamera(320,240,640,480),{width:320,height:240,x:0,y:0});
 assert.deepEqual(fitCamera(320,240,1920,1080),{width:320,height:180,x:0,y:30});
 const fit=fitCamera(320,240,1920,1080);assert.equal(fit.x+.2*fit.width,64);assert.equal(fit.y+.5*fit.height,120);
});
