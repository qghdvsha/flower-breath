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
test('flower 5 bubbles require left palm only, latch once and never trigger petals',()=>{
 const c=new BreathControl();c.index=4;
 for(let t=0;t<300;t+=40)c.input([hand('pair','Right',.3)],t);
 assert.equal(c.bubbleBursts,0);
 for(let t=400;t<800;t+=40)c.input([hand('open','Left')],t);
 assert.equal(c.bubbleBursts,1);assert.equal(c.petalBursts,0);
 c.input([],1000);for(let t=1100;t<1500;t+=40)c.input([hand('open','Left')],t);
 assert.equal(c.bubbleBursts,1);
 c.reset();assert.equal(c.bubbleBursts,0);
 c.index=4;c.phase='transition';trigger(c);assert.equal(c.bubbleBursts,0);
});
test('bubble visibility follows left palm with brief loss tolerance, folding and reset clear it',()=>{
 const c=new BreathControl();c.index=4;c.input([hand('open','Left')],100);
 c.step(.016,300);assert.equal(c.bubblePalmActive,true);
 c.input([],350);c.step(.016,650);assert.equal(c.bubblePalmActive,false);
 c.input([hand('open','Left')],700);assert.equal(c.bubblePalmActive,true);
 c.input([hand('fist','Left')],740);assert.equal(c.bubblePalmActive,false);
 c.input([hand('open','Left')],800);c.reset();assert.equal(c.bubblePalmActive,false);
});

test('lily accepts relaxed left palm but not a pair; a momentary ambiguous pose does not cancel playback',()=>{
 const c=new BreathControl();c.index=4;const relaxed={...hand('open','Left'),open:false,relaxedOpen:true};
 c.input([relaxed],0);assert.equal(c.bubbleBursts,0);c.input([relaxed],120);assert.equal(c.bubbleBursts,1);assert.equal(c.bubblePalmActive,true);
 c.input([{...relaxed,relaxedOpen:false}],160);assert.equal(c.bubblePalmActive,true);
 c.input([relaxed],200);assert.equal(c.bubbleBursts,1);
 c.input([hand('pair','Left')],240);assert.equal(c.bubblePalmActive,false);
 const other=new BreathControl();other.index=4;for(let t=0;t<500;t+=40)other.input([hand('pair','Left')],t);assert.equal(other.bubbleBursts,0);
});

test('a previous flower left-palm latch cannot block lily after switching',()=>{
 const c=new BreathControl();trigger(c);assert.equal(c.petalBursts,1);
 c.next=4;c.phase='transition';c.progress=.99;c.step(.05,200);
 assert.equal(c.index,4);trigger(c,1,300);assert.equal(c.bubbleBursts,1);
 trigger(c,1,1000);assert.equal(c.bubbleBursts,1);
});
