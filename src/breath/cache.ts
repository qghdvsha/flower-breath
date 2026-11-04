export type Flower={id:number;name:string;frames:number;width:number;height:number;closed:number;open:number;color:string;packedBubbles?:boolean;frameExtension?:string;framePath?:string};
type Entry={image:ImageBitmap;used:number};
export class FrameCache {
 private entries=new Map<string,Entry>();private tasks=new Map<string,{flower:Flower;frame:number;abort:AbortController}>();
 private wanted:{flower:Flower;frame:number}[]=[];private tick=0;private disposed=false;private protected=new Set<string>();
 error='';loads=0;evictions=0;peak=0;
 constructor(readonly capacity=24){}
 private key(f:Flower,n:number){return `${f.id}/${n}`;}
 get(f:Flower,n:number){const e=this.entries.get(this.key(f,n));if(e){e.used=++this.tick;return e.image;}}
 nearest(f:Flower,n:number){let best:Entry|undefined,dist=Infinity;for(const [key,e]of this.entries){const [id,frame]=key.split('/').map(Number);if(id===f.id&&Math.abs(n-frame)<dist){dist=Math.abs(n-frame);best=e;}}if(best)best.used=++this.tick;return best?.image;}
 bracket(f:Flower,n:number){
  let low=-Infinity,high=Infinity,lower:ImageBitmap|undefined,upper:ImageBitmap|undefined;
  for(const [key,e]of this.entries){const [id,frame]=key.split('/').map(Number);if(id!==f.id)continue;
   if(frame<=n&&frame>low){low=frame;lower=e.image;}if(frame>=n&&frame<high){high=frame;upper=e.image;}}
  if(!lower&&!upper)return undefined;if(!lower){lower=upper;low=high;}if(!upper){upper=lower;high=low;}
  this.get(f,low);this.get(f,high);return {lower:lower!,upper:upper!,low,high};
 }
 request(requests:{flower:Flower;frame:number}[]){
  this.wanted=requests.filter((r,i,a)=>a.findIndex(v=>v.flower.id===r.flower.id&&v.frame===r.frame)===i);
  this.protected=new Set(this.wanted.slice(0,4).map(r=>this.key(r.flower,r.frame)));
  // Finish the at-most-three active decodes for this scene: cancelling them on
  // every render can starve fast gestures. Only queued work follows the latest input.
  const ids=new Set(this.wanted.map(r=>r.flower.id));
  for(const task of this.tasks.values())if(!ids.has(task.flower.id))task.abort.abort();
  this.pump();
 }
 private pump(){if(this.disposed)return;for(const r of this.wanted){if(this.tasks.size>=3)break;const key=this.key(r.flower,r.frame);if(this.entries.has(key)||this.tasks.has(key))continue;
   const abort=new AbortController();this.tasks.set(key,{...r,abort});void this.load(key,r,abort);
  }}
 private async load(key:string,r:{flower:Flower;frame:number},abort:AbortController){
  try{
   const res=await fetch(`${r.flower.framePath??`/videos/frames/${r.flower.id}`}/${String(r.frame).padStart(3,'0')}.${r.flower.frameExtension??'jpg'}`,{signal:abort.signal});if(!res.ok)throw new Error(`帧读取失败 (${res.status})`);
   const image=await createImageBitmap(await res.blob());if(this.disposed||abort.signal.aborted){image.close();return;}
   while(this.entries.size>=this.capacity){let oldestKey='',age=Infinity;for(const [k,e]of this.entries)if(!this.protected.has(k)&&e.used<age){age=e.used;oldestKey=k;}if(!oldestKey){image.close();return;}this.entries.get(oldestKey)!.image.close();this.entries.delete(oldestKey);this.evictions++;}
   this.entries.set(key,{image,used:++this.tick});this.loads++;this.peak=Math.max(this.peak,this.entries.size);
  }catch(e){if(!abort.signal.aborted&&!this.disposed){this.error=e instanceof Error?e.message:String(e);this.wanted=this.wanted.filter(v=>this.key(v.flower,v.frame)!==key);}}
  finally{this.tasks.delete(key);this.pump();}
 }
 get diagnostics(){return {decoded:this.entries.size,capacity:this.capacity,inFlight:this.tasks.size,peak:this.peak,loads:this.loads,evictions:this.evictions,estimatedDecodedMB:Math.round([...this.entries.values()].reduce((sum,e)=>sum+e.image.width*e.image.height*4,0)/1048576)};}
 clearError(){this.error='';}
 dispose(){this.disposed=true;for(const t of this.tasks.values())t.abort.abort();this.tasks.clear();for(const e of this.entries.values())e.image.close();this.entries.clear();}
}
