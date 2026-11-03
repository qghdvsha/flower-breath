import {clamp,type Signal} from './gestures';

// Camera landmarks are already mirrored in Camera.start. Only the video is CSS-mirrored.
export function fitCamera(width:number,height:number,videoWidth:number,videoHeight:number){
 const scale=Math.min(width/videoWidth,height/videoHeight);
 return {width:videoWidth*scale,height:videoHeight*scale,x:(width-videoWidth*scale)/2,y:(height-videoHeight*scale)/2};
}
export function drawHandOverlay(canvas:HTMLCanvasElement,video:HTMLVideoElement,signal:Signal|undefined,now:number){
 const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;
 const dpr=Math.min(devicePixelRatio,2),w=box.width,h=box.height;
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 const c=canvas.getContext('2d')!;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 if(!signal||now-signal.time>350)return;
 const fit=fitCamera(w,h,video.videoWidth||640,video.videoHeight||480);
 const chains=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
 for(const hand of signal.hands){
  const points=hand.points.map(p=>({x:fit.x+clamp(p.x)*fit.width,y:fit.y+clamp(p.y)*fit.height}));
  const right=hand.side==='Right',open=!hand.folded&&(hand.relaxedOpen??hand.open),pair=hand.pair||(hand.folded&&hand.pinch<.44);
  const color=right?'#a5f5cc':'#9ccfe5',accent=open?'#ffd3a0':'#ffe6b5';
  c.save();c.globalAlpha=right?1:.65;c.lineCap='round';c.lineJoin='round';
  for(const chain of chains){c.beginPath();chain.forEach((n,i)=>{const p=points[n];i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.strokeStyle='#071b22aa';c.lineWidth=4;c.stroke();c.strokeStyle=color;c.lineWidth=1.5;c.stroke();}
  for(let i=0;i<points.length;i++){const p=points[i],tip=[4,8,12,16,20].includes(i);c.beginPath();c.arc(p.x,p.y,tip?3:2,0,Math.PI*2);c.fillStyle=tip?accent:'#ecfff6';c.fill();}
  const tips=open?[4,8,12,16,20]:pair?[4,8]:[8];
  for(const tip of tips){const p=points[tip],pulse=(Math.sin(now*.005+tip)+1)*.5;c.beginPath();c.arc(p.x,p.y,6+pulse*2,0,Math.PI*2);c.strokeStyle=accent;c.lineWidth=1.2;c.stroke();c.globalAlpha=(right?1:.65)*.25;c.beginPath();c.arc(p.x,p.y,10+pulse*3,0,Math.PI*2);c.stroke();c.globalAlpha=right?1:.65;}
  if(right&&pair){const a=points[4],b=points[8];c.setLineDash([3,4]);c.strokeStyle=accent;c.lineDashOffset=-now*.015;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([]);}
  const wrist=points[0];c.font='600 10px "Segoe UI",sans-serif';c.fillStyle='#071b22cc';const lx=Math.min(w-26,Math.max(4,wrist.x-10)),ly=Math.min(h-5,Math.max(18,wrist.y+18));c.fillRect(lx-3,ly-12,23,17);c.fillStyle=color;c.fillText(right?'R':'L',lx+4,ly);c.restore();
 }
}
