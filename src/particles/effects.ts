import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, NormalBlending, Points, ShaderMaterial, Vector2, Vector3 } from 'three';
import { Life } from '../life';
import { branches, random, wingPoint } from './geometry';
import { noiseGLSL } from './shaders';

export class TrailPool {
  readonly positions:Float32Array; readonly velocities:Float32Array;
  readonly births:Float32Array; readonly seeds:Float32Array;
  cursor=0; serial=0;
  constructor(readonly capacity:number,readonly lifetime:number){
    this.positions=new Float32Array(capacity*3);this.velocities=new Float32Array(capacity*3);
    this.births=new Float32Array(capacity).fill(-1000);this.seeds=new Float32Array(capacity*3);
  }
  emit(time:number,p:Vector3,v:Vector3,color:number,size:number){
    const i=this.cursor;this.positions.set([p.x,p.y,p.z],i*3);this.velocities.set([v.x,v.y,v.z],i*3);
    this.births[i]=time;this.seeds.set([color,size,random(this.serial++)],i*3);
    this.cursor=(i+1)%this.capacity;
  }
  active(time:number){let n=0;for(const birth of this.births)if(time>=birth&&time-birth<this.lifetime)n++;return n;}
  clear(){this.births.fill(-1000);}
}
const vertex=/* glsl */`
attribute vec3 aVelocity,aSeed;attribute float aBirth;
uniform float uTime,uLife,uDpr,uSmoke;
varying vec3 vSeed;varying float vAge,vFade;
void main(){
 float age=uTime-aBirth;vAge=age;vSeed=aSeed;
 vFade=step(0.,age)*(1.-smoothstep(uLife*.30,uLife,age));
 vec3 p=position+aVelocity*age;
 p.x+=sin(age*1.7+aSeed.z*12.)*age*.025;
 p.z+=cos(age*1.2+aSeed.z*15.)*age*.025;
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
 float size=mix(aSeed.y*(1.-.6*clamp(age/uLife,0.,1.)),aSeed.y*(.6+max(age,0.)*.6),uSmoke);
 gl_PointSize=clamp(size*uDpr*7./-mv.z,1.,180.*uDpr);
 if(age<0.||age>uLife)gl_PointSize=0.;
}`;
const fragment=/* glsl */`
precision highp float;
uniform float uSmoke,uTime;varying vec3 vSeed;varying float vAge,vFade;
${noiseGLSL}
void main(){
 vec2 p=gl_PointCoord*2.-1.;float r=length(p);if(r>1.||vFade<=0.)discard;
 vec3 color=mix(spectrum(vSeed.x),vec3(.84,.81,.93),.35);
 float a;
 if(uSmoke>.5){
   vec2 curl=vec2(sin(p.y*4.+vAge*.8),cos(p.x*4.-vAge*.6))*.24;
   float n=fbm(vec3((p+curl)*4.+vSeed.z*13.,vAge*.33));
   float threads=smoothstep(.32,.68,n);
   a=threads*pow(1.-r,1.6)*.16*vFade*smoothstep(0.,.3,vAge);
   color=mix(color,vec3(.6,.59,.68),.55);
 }else{
   a=(exp(-r*r*12.)+.20*exp(-r*r*3.))*vFade;
 }
 gl_FragColor=vec4(color,a);
 #include <colorspace_fragment>
}`;

function cloud(pool:TrailPool,smoke:boolean){
  const g=new BufferGeometry();
  for(const [name,data,size] of [['position',pool.positions,3],['aVelocity',pool.velocities,3],['aBirth',pool.births,1],['aSeed',pool.seeds,3]] as [string,Float32Array,number][])
    g.setAttribute(name,new BufferAttribute(data,size).setUsage(DynamicDrawUsage));
  const m=new ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,
    blending:smoke?NormalBlending:AdditiveBlending,uniforms:{uTime:{value:0},uLife:{value:pool.lifetime},uDpr:{value:1},uSmoke:{value:smoke?1:0}}});
  const points=new Points(g,m);points.frustumCulled=false;points.renderOrder=smoke?3:4;return points;
}

export class LifeEffects {
  readonly sparks=new TrailPool(2200,3.6);
  readonly gas=new TrailPool(160,2.4);
  readonly sparkPoints=cloud(this.sparks,false);
  readonly gasPoints=cloud(this.gas,true);
  private emission=0;private smokeEmission=0;private serial=0;
  private tips=branches().filter(b=>b.depth>=3);
  private previousTime=0;
  update(life:Life,offset:Vector2,visible:number,dpr:number,reduced:boolean){
    const dt=Math.min(.05,Math.max(0,life.time-this.previousTime));this.previousTime=life.time;
    if(!life.kind){this.sparks.clear();this.gas.clear();}
    const emit=(smoke:boolean)=>{
      const seed=this.serial++,a=random(seed+3),b=random(seed+13),c=random(seed+41);
      let p=new Vector3(),v=new Vector3(),hue=.8;
      if(life.kind==='butterfly'){
        const side=a>.5?1:-1,lower=b<.35;
        p.fromArray(wingPoint(c,.85+random(seed+7)*.15,side,lower));
        const bend=.18+(.5+.5*Math.sin(life.time*5.2))*.88+Math.abs(p.x)*.12*Math.sin(life.time*5.2-.6);
        p.z+=Math.abs(p.x)*Math.sin(bend);p.x*=Math.cos(bend);p.z+=.035*Math.sin(p.y*12+life.time*3);
        p.applyAxisAngle(new Vector3(1,0,0),-.12).applyAxisAngle(new Vector3(0,1,0),.18+Math.sin(life.time*.43)*.18).multiplyScalar(1.15);
        p.x+=offset.x;p.y+=offset.y+Math.sin(life.time*1.7)*.035;
        v.set(side*(smoke?.11:.025),.035+b*.04,(c-.5)*.13);hue=a;
      }else if(life.kind==='flower'){
        const theta=a*Math.PI*2+life.time*.16,r=.25+life.bloom*(.6+b*1.1);
        p.set(Math.cos(theta)*r,.35+b*.25,Math.sin(theta)*r);
        p.applyAxisAngle(new Vector3(1,0,0),.88).multiplyScalar(1.22);p.y+=.1;
        v.set((a-.5)*.1,.12+b*.12,(c-.5)*.12);hue=a>.85?.75:.11;
      }else if(life.kind==='tree'){
        const limb=this.tips[Math.floor(a*this.tips.length)];if(life.growth<limb.end)return;
        p.copy(limb.b).add(new Vector3((a-.5)*.3,(b-.5)*.3,(c-.5)*.3)).applyAxisAngle(new Vector3(0,1,0),life.rotation);
        v.set((a-.5)*.08,.10+b*.1,(c-.5)*.08);hue=.2+a*.6;
      }
      (smoke?this.gas:this.sparks).emit(life.time,p,v,hue,smoke?(life.kind==='tree'?95+b*65:65+b*65):2+b*b*11);
    };
    if(life.kind&&visible>.15){
      this.emission+=dt*(life.kind==='butterfly'?240:life.kind==='tree'?110:75)*visible*(reduced?.65:1);
      this.smokeEmission+=dt*(life.kind==='butterfly'?30:life.kind==='tree'?60:8)*visible*(reduced?.4:1);
      while(this.emission>=1){emit(false);this.emission--;}
      while(this.smokeEmission>=1){emit(true);this.smokeEmission--;}
    }
    for(const points of [this.sparkPoints,this.gasPoints]){
      for(const attr of Object.values(points.geometry.attributes))attr.needsUpdate=true;
      points.material.uniforms.uTime.value=life.time;points.material.uniforms.uDpr.value=dpr;
    }
  }
  dispose(){for(const p of [this.sparkPoints,this.gasPoints]){p.geometry.dispose();p.material.dispose();}}
}
