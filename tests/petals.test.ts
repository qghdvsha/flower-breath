import {test} from 'node:test';import assert from 'node:assert/strict';import {BreathControl} from '../src/breath/control';import {classify} from '../src/gestures';import {landmarks} from './fixtures';
const hand=(pose:'pair'|'open'|'fist',side:'Left'|'Right',amount=1)=>classify(landmarks(pose,side,.65,amount),side);
const trigger=(c:BreathControl,amount=1,t=0)=>{for(let i=0;i<=4;i++)c.input([hand('pair','Right',amount),hand('open','Left')],t+i*40);};
test('petals require simultaneous right pair >=90% and left open, only on flowers 1 and 3',()=>{
 for(let index=0;index<5;index++){const c=new BreathControl();c.index=index;trigger(c);assert.equal(c.petalBursts,index===0||index===2?1:0);assert.equal(c.phase,'idle');}
 const c=new BreathControl();trigger(c,.5);assert.equal(c.petalBursts,0);for(let i=0;i<10;i++)c.input([hand('open','Left')],500+i*40);assert.equal(c.petalBursts,0);
 for(const amount of [.899,.9,.901]){const c=new BreathControl(),r=hand('pair','Right');r.pinch=.2+amount*1.15;for(let t=0;t<=160;t+=40)c.input([r,hand('open','Left')],t);assert.equal(c.petalBursts,amount>=.9?1:0);}
});
test('held left palm and missing hands do not replay, folding rearms and transitions block',()=>{
 const c=new BreathControl();trigger(c);trigger(c,1,1000);c.input([],1500);trigger(c,1,2000);assert.equal(c.petalBursts,1);
 for(let i=0;i<5;i++)c.input([hand('fist','Left')],2500+i*40);trigger(c,1,3000);assert.equal(c.petalBursts,2);
 c.reset();c.phase='transition';trigger(c);assert.equal(c.petalBursts,0);
});
