import {clamp,type Hand} from '../gestures';
export class BreathControl {
 constructor(public flowerCount=5){}
 index=0;next=0;aperture=.65;target=.65;phase:'idle'|'loading'|'transition'='idle';progress=0;switches=0;
 private lastInput=-Infinity;private rightSeen=-Infinity;private rightSince=0;private lastRight=-Infinity;
 private openSince:number|undefined;private openFrames=0;private releaseSince:number|undefined;private releaseFrames=0;private latched=false;
 private leftOpenSince:number|undefined;private leftOpenFrames=0;private leftReleaseSince:number|undefined;private leftReleaseFrames=0;private leftLatched=false;petalBursts=0;
 gestureHint='右手双指开合 · 五指张开换下一朵';
 reset(){this.index=0;this.next=0;this.aperture=.65;this.target=.65;this.phase='idle';this.progress=0;this.rightSeen=-Infinity;this.lastRight=-Infinity;this.openSince=undefined;this.openFrames=0;this.releaseSince=undefined;this.releaseFrames=0;this.latched=false;this.leftOpenSince=undefined;this.leftOpenFrames=0;this.leftReleaseSince=undefined;this.leftReleaseFrames=0;this.leftLatched=false;this.petalBursts=0;this.gestureHint='右手双指开合 · 左手张掌落瓣';}
 input(hands:Hand[],t:number){
  this.lastInput=t;
  const right=hands.find(h=>h.side==='Right');
  const eligible=!!right&&right.pair&&right.folded&&clamp((right.pinch-.2)/1.15)>=.9&&this.phase==='idle'&&(this.index===0||this.index===2);
  this.handleLeftPetals(hands.find(h=>h.side==='Left'),t,eligible);
  if(!right){this.openSince=undefined;this.openFrames=0;this.releaseSince=undefined;this.releaseFrames=0;this.gestureHint='请伸出右手';return;}
  if(t-this.lastRight>250){this.openSince=undefined;this.openFrames=0;this.releaseSince=undefined;this.releaseFrames=0;}
  this.lastRight=t;
  const open=!right.folded&&(right.relaxedOpen??right.open);
  if(open){
   this.rightSeen=-Infinity;this.releaseSince=undefined;this.releaseFrames=0;
   // Open palm is a separate action: retain the last pinch aperture while switching.
   if(this.latched||this.phase!=='idle'){
    this.latched=true;this.openSince=undefined;this.openFrames=0;
    this.gestureHint=this.phase==='idle'?'收回双指，再张掌可换下一朵':'正在换境';return;
   }
   this.openSince??=t;this.openFrames++;
   this.gestureHint='已识别右手张掌';
   if(t-this.openSince>=120&&this.openFrames>=2){
    this.next=(this.index+1)%this.flowerCount;this.phase='loading';this.progress=0;this.latched=true;this.openSince=undefined;this.openFrames=0;this.gestureHint='正在换到下一朵';
   }
   return;
  }
  this.openSince=undefined;this.openFrames=0;
  // Only a deliberate return to folded fingers rearms. Missing landmarks never rearm it.
  if(right.folded){this.releaseSince??=t;this.releaseFrames++;if(t-this.releaseSince>=100&&this.releaseFrames>=2)this.latched=false;}
  else{this.releaseSince=undefined;this.releaseFrames=0;}
  if(right.pair||(right.folded&&right.pinch<.44)){
   if(t-this.rightSeen>300)this.rightSince=t;
   this.rightSeen=t;if(t-this.rightSince>=55)this.target=clamp((right.pinch-.2)/1.15);
   this.gestureHint='右手双指控制花瓣 · 张掌换花';
  }else this.gestureHint='右手双指开合 · 五指张开换下一朵';
 }
 private handleLeftPetals(left:Hand|undefined,t:number,eligible:boolean){
  if(!left){this.leftOpenSince=undefined;this.leftOpenFrames=0;this.leftReleaseSince=undefined;this.leftReleaseFrames=0;return;}
  const open=left.open;
  if(open){
   this.leftReleaseSince=undefined;this.leftReleaseFrames=0;
   if(!eligible||this.leftLatched){this.leftOpenSince=undefined;this.leftOpenFrames=0;return;}
   this.leftOpenSince??=t;this.leftOpenFrames++;
   if(t-this.leftOpenSince>=120&&this.leftOpenFrames>=2){this.petalBursts++;this.leftLatched=true;this.leftOpenSince=undefined;this.leftOpenFrames=0;}
  }else{
   this.leftOpenSince=undefined;this.leftOpenFrames=0;
   if(left.folded){this.leftReleaseSince??=t;this.leftReleaseFrames++;if(t-this.leftReleaseSince>=120&&this.leftReleaseFrames>=2)this.leftLatched=false;}
   else{this.leftReleaseSince=undefined;this.leftReleaseFrames=0;}
  }
 }
 step(dt:number,now:number){
  if(now-this.lastInput<650||Math.abs(this.aperture-this.target)>.0001)this.aperture+=(this.target-this.aperture)*(1-Math.exp(-Math.min(dt,.05)*24));
  if(this.phase==='transition'){this.progress=Math.min(1,this.progress+dt/.95);if(this.progress===1){this.index=this.next;this.phase='idle';this.switches++;}}
 }
 beginTransition(){if(this.phase==='loading'){this.phase='transition';this.progress=0;}}
 failTransition(){this.phase='idle';this.next=this.index;this.progress=0;}
}
