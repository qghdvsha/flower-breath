import {VideoTexture,SRGBColorSpace,LinearFilter} from 'three';
import type {BreathControl} from './control';
// Play the supplied bubble scene as a video. No frame scrubbing or sprite extraction.
export class Bubbles {
 readonly video=document.createElement('video');readonly texture:VideoTexture;
 mix=0;error='';private seen=0;private current=-1;private pending=false;private starting=false;private playing=false;private generation=0;private disposed=false;private clock=0;private deadline=0;private loaded=false;
 constructor(){
  this.video.muted=true;this.video.playsInline=true;this.video.preload='auto';
  this.texture=new VideoTexture(this.video);this.texture.colorSpace=SRGBColorSpace;this.texture.flipY=false;this.texture.minFilter=LinearFilter;this.texture.magFilter=LinearFilter;this.texture.generateMipmaps=false;
  this.video.onerror=()=>{if(this.loaded){this.error='泡泡视频未能解码，请使用 Chrome 或 Edge 重试';this.cancel();}};
 }
 private cancel(){this.generation++;this.pending=false;this.starting=false;this.playing=false;}
 update(c:BreathControl,dt:number){
  this.clock+=dt;
  if(this.current!==c.index){this.cancel();this.current=c.index;this.seen=c.bubbleBursts;this.mix=0;this.error='';this.video.pause();
   if(this.current===4){this.loaded=true;this.video.src='/videos/hd/originals/lily-final-b.mp4';this.video.load();}
   else if(this.loaded){this.loaded=false;this.video.removeAttribute('src');this.video.load();}
  }
  if(c.bubbleBursts<this.seen){this.cancel();this.mix=0;this.video.pause();this.seen=c.bubbleBursts;}
  if(c.bubbleBursts>this.seen){this.seen=c.bubbleBursts;if(c.index===4&&!this.playing&&!this.pending&&!this.starting){if(this.error){this.error='' ;this.video.load();}this.pending=true;this.deadline=this.clock+10;}}
  if(c.phase!=='idle'||!c.bubblePalmActive){if(this.pending||this.starting||this.playing)this.cancel();}
  if(this.pending&&this.video.readyState>=2){
   this.pending=false;this.starting=true;const generation=++this.generation;this.video.currentTime=.001;this.video.playbackRate=1;
   void this.video.play().then(()=>{if(this.disposed||generation!==this.generation){this.video.pause();return;}this.starting=false;this.playing=true;}).catch(()=>{if(generation===this.generation){this.starting=false;this.error='泡泡视频播放失败，请收手后重试';}});
  }
  if(this.pending&&this.clock>this.deadline){this.pending=false;this.error='泡泡素材加载超时，请刷新重试';}
  if(this.video.ended)this.playing=false;
  const remaining=this.video.duration-this.video.currentTime;
  const target=this.playing&&this.video.readyState>=2?Math.min(1,Math.max(0,remaining/.4)):0;
  this.mix+=Math.max(-dt/.4,Math.min(dt/.4,target-this.mix));
  if(!this.playing&&this.mix<.001&&!this.pending&&!this.starting)this.video.pause();
 }
 get diagnostics(){return {active:this.mix>.001,mix:this.mix,playing:this.playing,pending:this.pending,time:this.video.currentTime,duration:this.video.duration||0,presentedFrames:this.video.getVideoPlaybackQuality?.().totalVideoFrames??0,source:'user-dynamic-video',error:this.error};}
 dispose(){this.disposed=true;this.cancel();this.loaded=false;this.video.pause();this.video.removeAttribute('src');this.video.load();this.texture.dispose();}
}
