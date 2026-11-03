import {useEffect,useRef,useState} from 'react';import {createRoot} from 'react-dom/client';
import {Camera} from './camera';import {Life} from './life';import {ParticleStage} from './particles/stage';import {classify,GestureEngine,type Point,type Side,type Signal} from './gestures';
import {BreathControl} from './breath/control';import {BreathStage} from './breath/stage';import './style.css';
import {drawHandOverlay} from './hand-overlay';
type Mode='breath'|'legacy';
declare global {interface Window {__flowerTest?:{feed:(hands:{side:Side;points:Point[]}[])=>void;state:()=>any;reset:()=>void}}}
function App(){
 const canvas=useRef<HTMLCanvasElement>(null),video=useRef<HTMLVideoElement>(null),skeleton=useRef<HTMLCanvasElement>(null);
 const camera=useRef(new Camera()),control=useRef(new BreathControl()),life=useRef(new Life()),stage=useRef<BreathStage|ParticleStage|undefined>(undefined);
 const modeRef=useRef<Mode>('breath'),signal=useRef<Signal|undefined>(undefined),startId=useRef(0),demoRef=useRef(false),previewRef=useRef(true),runningRef=useRef(false);
 const [mode,setMode]=useState<Mode>('breath'),[started,setStarted]=useState(import.meta.env.DEV&&location.search.includes('testHarness')),[running,setRunning]=useState(false),[busy,setBusy]=useState(false),[settings,setSettings]=useState(false),[preview,setPreview]=useState(true),[debug,setDebug]=useState(false),[swap,setSwap]=useState(false),[error,setError]=useState(''),[demo,setDemo]=useState(false),[stats,setStats]=useState(''),[loaded,setLoaded]=useState(false),[tracking,setTracking]=useState('等待手部进入画面');
 const accept=(s:Signal)=>{signal.current=s;if(modeRef.current==='breath')control.current.input(s.hands,s.time);};
 function stop(){runningRef.current=false;startId.current++;camera.current.stop();signal.current=undefined;if(video.current)video.current.srcObject=null;setRunning(false);setBusy(false);}
 async function start(){const id=++startId.current;setBusy(true);setError('');setDemo(false);demoRef.current=false;
  const ok=await camera.current.start(video.current!,accept,m=>{runningRef.current=false;setError(m);setRunning(false);signal.current=undefined;},swap,()=>modeRef.current==='legacy'?life.current.context:{kind:null,side:null,locked:false});
  if(id!==startId.current)return;setBusy(false);runningRef.current=ok;setRunning(ok);if(ok){setStarted(true);setSettings(false);}}
 function reset(){control.current.reset();life.current.reset();camera.current.reset();signal.current=undefined;}
 function changeMode(value:Mode){demoRef.current=false;setDemo(false);modeRef.current=value;reset();setMode(value);setError('');}
 async function fullscreen(){try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen();}catch{setError('全屏未启用，可按 F11。');}}
 function toggleDemo(v:boolean){stop();demoRef.current=v;setDemo(v);reset();if(v){setStarted(true);setSettings(false);}}
 useEffect(()=>{
  let active:BreathStage|ParticleStage;try{active=mode==='breath'?new BreathStage(canvas.current!):new ParticleStage(canvas.current!);stage.current=active;}catch{setError('无法启动图形渲染，请启用浏览器硬件加速。');return;}
  let frame=0,last=performance.now(),ui=0,overlayTime=0,demoTime=0,demoCycle=0;
  const onLost=(e:Event)=>{e.preventDefault();setError('图形设备已断开，请重新加载页面。');};canvas.current!.addEventListener('webglcontextlost',onLost);
  const loop=(now:number)=>{const dt=Math.min(.06,(now-last)/1000);last=now;
   if(mode==='breath'){
    if(demoRef.current){demoTime+=dt;control.current.target=(1-Math.cos(demoTime*.85))*.5;const cycle=Math.floor(demoTime/10);if(cycle>demoCycle&&control.current.phase==='idle'){demoCycle=cycle;control.current.next=(control.current.index+1)%control.current.flowerCount;control.current.phase='loading';}}
    control.current.step(dt,now);(active as BreathStage).render(control.current,dt);
   }else{life.current.step(dt,signal.current,now);(active as ParticleStage).render(life.current,dt);}
   if(now-overlayTime>=33){overlayTime=now;if(runningRef.current&&previewRef.current&&skeleton.current&&video.current)drawHandOverlay(skeleton.current,video.current,signal.current,now);}
   if(now-ui>150){ui=now;
    const fresh=signal.current&&now-signal.current.time<350?signal.current:undefined;
    const right=fresh?.hands.find(h=>h.side==='Right');
    setTracking((active instanceof BreathStage&&active.diagnostics.petals.error)?active.diagnostics.petals.error:(active instanceof BreathStage&&active.diagnostics.petals.playing)?'花瓣飘落 · 轻风摇曳':!runningRef.current?'摄像头已关闭':!fresh?.hands.length?'等待手部进入画面':!right?'左手已识别 · 右手展开≥90%可落瓣':mode==='breath'&&control.current.phase!=='idle'?'张掌已识别 · 正在换花':!right.folded&&(right.relaxedOpen??right.open)?'右手张掌 · 收指后可再换花':right.pair||(right.folded&&right.pinch<.44)?`右手双指 · 开合 ${Math.round(control.current.aperture*100)}%`:'右手已识别');
    if(mode==='breath'){const s=active as BreathStage;setLoaded(v=>v||s.ready);if(s.error)setError(s.error);setStats(`${s.flowers[control.current.index]?.name??'载入'} · 开合 ${Math.round(control.current.aperture*100)}% · ${control.current.phase}\n${control.current.gestureHint}\n缓存 ${s.cache.diagnostics.decoded}/24 · 推理 ${camera.current.inferenceFrames} 帧`);}
    else{setLoaded(true);setStats(`${life.current.kind??'等待手势'} · ${life.current.phase}`);}
   }frame=requestAnimationFrame(loop);
  };frame=requestAnimationFrame(loop);
  if(import.meta.env.DEV&&location.search.includes('testHarness')){const engine=new GestureEngine();window.__flowerTest={feed:h=>accept(engine.update(h.map(v=>classify(v.points,v.side)),performance.now(),modeRef.current==='legacy'?life.current.context:{kind:null,side:null,locked:false})),reset:()=>{reset();engine.reset();},state:()=>({mode:modeRef.current,index:control.current.index,next:control.current.next,aperture:control.current.aperture,phase:control.current.phase,progress:control.current.progress,switches:control.current.switches,petalBursts:control.current.petalBursts,legacy:life.current.kind,cameraFrames:camera.current.inferenceFrames,resources:active.diagnostics})};}
  return()=>{cancelAnimationFrame(frame);canvas.current?.removeEventListener('webglcontextlost',onLost);active.dispose();delete window.__flowerTest;};
 },[mode]);
 useEffect(()=>()=>camera.current.stop(),[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setSettings(false);if(e.key==='f'&&e.target===document.body)void fullscreen();};addEventListener('keydown',key);return()=>removeEventListener('keydown',key);},[]);
 return <main><canvas ref={canvas} className="world" aria-label="Flower Breath 花境"/>
  {!started&&<section className="entry"><div className="wordmark">FLOWER BREATH</div><h1>花 随 息 生</h1><p>指尖起落，花境呼吸。</p><button className="start" disabled={busy||!loaded} onClick={start}>{busy?'正在连接摄像头':loaded?'开启体验':'正在唤醒花境'}</button><span className="entry-note">右手双指开合 · 张掌换境</span></section>}
  <button className="settings-trigger" aria-label="设置" aria-expanded={settings} onClick={()=>setSettings(v=>!v)}>···</button>
  {demo&&<span className="demo-tag">自动演示</span>}
  <aside className="camera-dock" hidden={!running||!preview} aria-label="实时摄像头与手势识别">
   <div className="camera-feed"><video ref={video} muted playsInline aria-label="镜像实时摄像头"/><canvas ref={skeleton} aria-label="手部关键点与指尖识别动画"/>
    <span className="camera-live"><i/>LIVE · HAND TRACKING</span>
   </div><div className="camera-status">{tracking}</div>
  </aside>
  <section className={'settings '+(settings?'open':'')} inert={!settings} aria-label="设置面板"><header><span>FLOWER BREATH</span><button aria-label="关闭设置" onClick={()=>setSettings(false)}>×</button></header>
   <label>体验模式<select aria-label="体验模式" value={mode} onChange={e=>changeMode(e.target.value as Mode)}><option value="breath">视频花境</option><option value="legacy">原图生命 · 蝴蝶与树</option></select></label>
   <div className="actions"><button onClick={running||busy?stop:start}>{busy?'取消连接':running?'关闭摄像头':'开启摄像头'}</button><button onClick={reset}>重置</button><button onClick={fullscreen}>全屏</button></div>
   <label>摄像头预览<input type="checkbox" checked={preview} onChange={e=>{setPreview(e.target.checked);previewRef.current=e.target.checked;}}/></label>
   <label>调试信息<input type="checkbox" checked={debug} onChange={e=>setDebug(e.target.checked)}/></label>
   <label>交换左右手标签<input type="checkbox" disabled={running||busy} checked={swap} onChange={e=>setSwap(e.target.checked)}/></label>
   {mode==='breath'&&<label>自动演示（无需摄像头）<input type="checkbox" checked={demo} onChange={e=>toggleDemo(e.target.checked)}/></label>}
   {debug&&<output>{stats}</output>}
   <details><summary>操作说明</summary>{mode==='breath'?<><p>仅用右手：收起后三指，拇指与食指捏合、分开，控制花瓣。</p><p>右手五指张开，按顺序换到下一朵；无需滑动。持续张开只换一次，收回双指姿态后再张开即可继续换花。</p><p>第1、3朵花：右手双指展开≥90%，同时左手五指张开，播放一段落瓣与轻摇。左手收拢后再张开可再次触发。</p></>:<p>左食指引导蝴蝶；左手展开、抬升使树生长；右手双指控制原图花朵。</p>}<p className="muted">视频素材为 AI 生成。摄像头仅在本机处理。</p></details>
  </section>
  {error&&<aside role="alert" className="error"><p>{error}</p><button onClick={()=>{setError('');if(stage.current instanceof BreathStage)stage.current.retry();}}>重试素材</button><button onClick={start} disabled={busy}>重连摄像头</button><button onClick={()=>setError('')}>关闭</button></aside>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
