import {test} from 'node:test';import assert from 'node:assert/strict';
import {repairWatermark} from '../scripts/watermark-repair.mjs';
function fixture(level:number){const p=new Uint8ClampedArray(1280*720*4);for(let i=0;i<p.length;i+=4){p[i]=level;p[i+1]=level+20;p[i+2]=level+40;p[i+3]=255;}for(let y=640;y<690;y++)for(let x=1050;x<1280;x++){const k=(y*1280+x)*4;p[k]=p[k+1]=p[k+2]=240;}return p;}
test('repair covers animated watermark through the right edge and follows each frame',()=>{
 for(const level of [30,80,120]){const p=fixture(level);repairWatermark(p,1280,720,[1020,600,1280,720]);for(let y=640;y<690;y++)for(let x=1050;x<1280;x++){const k=(y*1280+x)*4;assert.equal(p[k],level);assert.equal(p[k+1],level+20);assert.equal(p[k+2],level+40);}}
});
test('repair leaves the flower and pixels outside its specified region untouched',()=>{
 const p=fixture(30),before=p.slice();repairWatermark(p,1280,720,[1020,600,1280,720]);
 for(let y=0;y<720;y++)for(let x=0;x<1280;x++)if(x<1020||y<600){const k=(y*1280+x)*4;for(let c=0;c<4;c++)assert.equal(p[k+c],before[k+c]);}
});
