import {VideoTexture,SRGBColorSpace,LinearFilter} from 'three';
import type {BreathControl} from './control';

// These are the user's original video elements, including petals and gentle sway.
// Native sequential playback avoids scrubbing or decoding all frames into memory.
export class PetalVideo {
 readonly video=document.createElement('video');readonly texture:VideoTexture;
 mix=0;private current=-1;private seen=0;private pending=false;private starting=false;private playing=false;private generation=0;private disposed=false;private clock=0;private deadline=0;error='';
 constructor(){this.video.muted=true;this.video.playsInline=true;this.video.preload='auto';this.texture=new VideoTexture(this.video);this.texture.colorSpace=SRGBColorSpace;this.texture.minFilter=LinearFilter;this.texture.magFilter=LinearFilter;this.texture.generateMipmaps=false;
  // VideoTexture uses DOM orientation, while the stage shader uses top-left bitmap UVs.
  this.texture.flipY=false;
  this.video.onerror=()=>{this.error='飘落素材未能解码，请使用本机 Chrome 或 Edge 重试';this.pending=false;this.playing=false;};
 }
 private stop(){this.generation++;this.pending=false;this.starting=false;this.playing=false;this.video.pause();}
 update(control:BreathControl,dt:number){
  this.clock+=dt;
  if(this.current!==control.index){this.stop();this.current=control.index;this.mix=0;this.error='';this.seen=control.petalBursts;
   if(this.current===0||this.current===2){this.video.src=`/videos/petals/originals/flower-${this.current+1}.MOV`;this.video.load();}else{this.video.removeAttribute('src');this.video.load();}
  }
  if(control.petalBursts<this.seen){this.stop();this.mix=0;this.seen=control.petalBursts;}
  if(control.petalBursts>this.seen){this.seen=control.petalBursts;if(!this.playing&&!this.pending&&!this.starting&&!this.error){this.pending=true;this.deadline=this.clock+5;}}
  if(control.phase!=='idle'||control.target<.88){if(this.pending||this.starting||this.playing)this.generation++;this.pending=false;this.starting=false;this.playing=false;}
  if(this.pending&&this.video.readyState>=2){this.pending=false;this.starting=true;const generation=++this.generation;this.video.currentTime=.04;
   void this.video.play().then(()=>{if(this.disposed||generation!==this.generation){return;}this.starting=false;this.playing=true;}).catch(()=>{if(generation===this.generation){this.starting=false;this.error='飘落播放未启动，请刷新后重试';this.playing=false;}});
  }
  if(this.pending&&this.clock>this.deadline){this.pending=false;this.error='飘落素材加载超时，请刷新后重试';}
  const end=this.current===2?2.8:3.1;
  if(this.video.currentTime>=end||this.video.ended)this.playing=false;
  const target=this.playing&&this.video.readyState>=2?Math.min(1,Math.max(0,(end-this.video.currentTime)/.4)):0;
  this.mix+=Math.max(-dt/.28,Math.min(dt/.28,target-this.mix));
  if(!this.playing&&this.mix<.001&&!this.pending&&!this.starting)this.video.pause();
 }
 get diagnostics(){return {playing:this.playing,pending:this.pending,mix:this.mix,time:this.video.currentTime,error:this.error};}
 dispose(){this.disposed=true;this.stop();this.video.removeAttribute('src');this.video.load();this.texture.dispose();}
}
