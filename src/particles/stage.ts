import { ACESFilmicToneMapping, PerspectiveCamera, Scene, Vector2, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { codes, Life } from '../life';
import { Cosmos } from './cosmos';
import { Artwork } from './artwork';
import { PhotoEffects } from './photo-effects';
export class ParticleStage {
 private renderer:WebGLRenderer;private backdrop=new Scene();private scene=new Scene();
 private camera=new PerspectiveCamera(42,1,.1,80);private cosmos=new Cosmos();
 private art=[0,1,2].map(k=>new Artwork(k));private effects=new PhotoEffects();
 private composer:EffectComposer;private bloom:UnrealBloomPass;private output:OutputPass;
 private width=0;private height=0;private average=1/60;private frames=0;private reduced=false;private now=0;
 private offset=new Vector2();private oldOffset=new Vector2();private center=new Vector2();count=1200;
 constructor(canvas:HTMLCanvasElement){
  this.renderer=new WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setClearColor(0x000000);this.renderer.toneMapping=ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.backdrop.add(this.cosmos.nebula,this.cosmos.stars);
  this.scene.add(...this.art.flatMap(a=>[a.mesh,a.dust]),this.effects.sparks,this.effects.crown,this.effects.mist);
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.backdrop,this.camera));
  this.bloom=new UnrealBloomPass(new Vector2(640,480),.25,.35,.42);this.output=new OutputPass();this.composer.addPass(this.bloom);this.composer.addPass(this.output);
 }
 render(life:Life,dt:number){
  this.now=life.time;
  if(innerWidth!==this.width||innerHeight!==this.height){this.width=innerWidth;this.height=innerHeight;this.renderer.setSize(this.width,this.height,false);this.composer.setSize(this.width,this.height);
   this.camera.aspect=this.width/this.height;this.camera.position.z=Math.max(7.5,3.7/(Math.tan(21*Math.PI/180)*this.camera.aspect));this.camera.updateProjectionMatrix();}
  this.average+=(dt-this.average)*.025;
  if(++this.frames%240===0&&this.average>.032&&!this.reduced&&life.kind){this.reduced=true;this.renderer.setPixelRatio(1);this.renderer.setSize(this.width,this.height,false);this.composer.setPixelRatio(1);this.bloom.enabled=false;}
  const vh=2*this.camera.position.z*Math.tan(21*Math.PI/180),vw=vh*this.camera.aspect;
  const offset=(p:{x:number;y:number},out:Vector2)=>out.set(Math.max(-vw/2+.95,Math.min(vw/2-.95,(p.x-.5)*vw)),Math.max(-vh/2+.95,Math.min(vh/2-.95,(.5-p.y)*vh)));
  offset(life.position,this.offset);offset(life.oldPosition,this.oldOffset);
  let butterfly=0,tree=0,treeGrowth=life.growth;
  this.art.forEach((art,i)=>{
   const current=!!life.kind&&codes[life.kind]===i,old=!!life.previous&&codes[life.previous]===i;
   let surface=0,dust=0,scatter=0;
   if(current){if(life.phase==='gather'){surface=(1-life.dispersion)*.32;dust=(1-life.dispersion*.5)*.9;scatter=life.dispersion;}
    else if(life.phase==='materialize'){surface=.32+.68*life.reveal;dust=.85*(1-life.reveal);}else if(life.phase==='alive')surface=1;}
   if(old&&life.phase==='scatter'){surface=1-Math.min(1,life.clock/.52);dust=Math.min(1,life.clock/.24)*(1-life.dispersion*.7);scatter=life.dispersion;}
   if(old&&life.phase==='drift'){dust=.3*(1-life.morph);scatter=1;}
   art.update(life.time,current?life.bloom:life.oldBloom,current?life.growth:life.oldGrowth,i===0?(current?this.offset:this.oldOffset):this.center,surface,dust,scatter,this.renderer.getPixelRatio());
   if(i===0&&current)butterfly=surface;if(i===2){tree=surface;treeGrowth=current?life.growth:life.oldGrowth;}
  });
  if(!life.kind)this.effects.trail.clear();this.effects.update(life.time,dt,this.offset,butterfly,tree,treeGrowth,this.renderer.getPixelRatio(),this.reduced);
  this.cosmos.update(life.time,this.renderer.getPixelRatio());this.composer.render();
  // Original artwork bypasses bloom/filmic tone mapping, preserving photographed colors.
  this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.scene,this.camera);this.renderer.autoClear=true;
 }
 get diagnostics(){return {geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,programs:this.renderer.info.programs?.length??0,
  trailCapacity:this.effects.trail.capacity,trailActive:this.effects.trail.active(this.now),gasCapacity:0,gasActive:0,reduced:this.reduced,sourcesLoaded:this.art.every(a=>a.loaded),assetErrors:this.art.map(a=>a.error).filter(Boolean),rendering:'original-image-mesh'};}
 dispose(){this.art.forEach(a=>a.dispose());this.effects.dispose();this.cosmos.dispose();this.bloom.dispose();this.output.dispose();this.composer.dispose();this.renderer.dispose();}
}
