import {classify,GestureEngine,type Signal,type Point,type Context,type Side} from './gestures';
export class Camera {
 private stream?:MediaStream;private worker?:Worker;private frame=0;private generation=0;private engine=new GestureEngine();private last=0;private videoTime=-1;private inFlight=false;
 private cancelLoad?:()=>void;
 inferenceFrames=0;inferenceMs=0;
 async start(video:HTMLVideoElement,onSignal:(s:Signal)=>void,onError:(s:string)=>void,swap=false,getContext:()=>Context=()=>({kind:null,side:null,locked:false})){
  this.stop();const generation=this.generation;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('需要使用 localhost 或 HTTPS 才能访问摄像头');
   if(!window.Worker||!window.OffscreenCanvas)throw new Error('请使用支持 Worker 与 OffscreenCanvas 的新版 Chrome 或 Edge');
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30},facingMode:'user'},audio:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}this.stream=stream;video.srcObject=stream;await video.play();
   if(generation!==this.generation)return false;
   const worker=new Worker('/vision/hand-worker.js');this.worker=worker;
   await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{this.cancelLoad=undefined;reject(new Error('本地识别模型加载超时，请重新开启摄像头'));},45000);
    const finish=(error?:Error)=>{clearTimeout(timer);this.cancelLoad=undefined;error?reject(error):resolve();};
    this.cancelLoad=()=>finish(new Error('已取消连接'));
    worker.onerror=e=>finish(new Error(e.message||'Worker 启动失败'));
    worker.onmessage=({data})=>{if(data.type==='ready')finish();else if(data.type==='error')finish(new Error(data.message));};
    worker.postMessage({type:'init'});
   });
   if(generation!==this.generation)return false;
   const fail=(message:string)=>{if(generation!==this.generation)return;this.stop();video.srcObject=null;onError(message);};
   stream.getVideoTracks()[0].onended=()=>fail('摄像头已断开，请重新开启。');
   worker.onerror=e=>fail(`识别线程中断：${e.message}`);
   worker.onmessage=({data})=>{
    if(generation!==this.generation)return;
    if(data.type==='error'){fail(`识别中断：${data.message}`);return;}
    if(data.type!=='result')return;
    this.inFlight=false;this.inferenceFrames++;this.inferenceMs=data.duration;
    const hands=(data.landmarks as Point[][]).map((points,i)=>{let side=data.handedness[i][0].categoryName as Side;if(swap)side=side==='Left'?'Right':'Left';return classify(points.map(v=>({x:1-v.x,y:v.y,z:v.z})),side,video.videoWidth/video.videoHeight);});
    onSignal(this.engine.update(hands,data.time,getContext()));
   };
   const loop=(t:number)=>{
    if(generation!==this.generation)return;
    // One transferable frame at a time. Skip obsolete frames instead of accumulating latency.
    const interval=33;
    if(!document.hidden&&!this.inFlight&&t-this.last>=interval&&video.readyState>=2&&video.currentTime!==this.videoTime){
     this.last=t;this.videoTime=video.currentTime;this.inFlight=true;
     createImageBitmap(video).then(bitmap=>{if(generation!==this.generation){bitmap.close();return;}worker.postMessage({type:'frame',bitmap,time:t},[bitmap]);}).catch(e=>fail(`摄像头取帧失败：${e.message}`));
    }this.frame=requestAnimationFrame(loop);
   };this.frame=requestAnimationFrame(loop);return true;
  }catch(e){if(generation!==this.generation)return false;this.stop();video.srcObject=null;const err=e as Error;onError(err.name==='NotAllowedError'?'摄像头权限被拒绝。请在浏览器地址栏允许摄像头，再点击开启。':err.name==='NotFoundError'?'未找到摄像头，请连接摄像头后重试。':err.name==='NotReadableError'?'摄像头被其他程序占用，请关闭占用程序后重试。':`无法启动：${err.message}`);return false;}
 }
 stop(){this.generation++;cancelAnimationFrame(this.frame);this.cancelLoad?.();this.cancelLoad=undefined;this.worker?.terminate();this.worker=undefined;this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=undefined;this.engine.reset();this.last=0;this.videoTime=-1;this.inFlight=false;this.inferenceFrames=0;}
 reset(){this.engine.reset();}
}
