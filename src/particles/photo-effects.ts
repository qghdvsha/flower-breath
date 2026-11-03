import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh, PlaneGeometry, Points, ShaderMaterial, Vector2, Vector3 } from 'three';
import { TrailPool } from './effects';
import { noiseGLSL } from './shaders';
import { random } from './geometry';
export class PhotoEffects {
 readonly trail=new TrailPool(1200,3.2);
 readonly sparks:Points<BufferGeometry,ShaderMaterial>;
 readonly crown:Points<BufferGeometry,ShaderMaterial>;
 readonly mist:Mesh<PlaneGeometry,ShaderMaterial>;
 private emission=0;private serial=0;private last=new Vector2();private wasButterfly=false;
 constructor(){
  const g=new BufferGeometry();
  for(const [name,data,n] of [['position',this.trail.positions,3],['aVelocity',this.trail.velocities,3],['aBirth',this.trail.births,1],['aSeed',this.trail.seeds,3]] as [string,Float32Array,number][])
   g.setAttribute(name,new BufferAttribute(data,n).setUsage(DynamicDrawUsage));
  this.sparks=new Points(g,new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,uniforms:{uTime:{value:0},uDpr:{value:1}},
   vertexShader:`attribute vec3 aVelocity,aSeed;attribute float aBirth;uniform float uTime,uDpr;varying vec3 vSeed;varying float vFade;
    void main(){float age=uTime-aBirth;vSeed=aSeed;vFade=1.-smoothstep(.5,3.2,age);vec3 p=position+aVelocity*age;p.x+=sin(age*1.3+aSeed.z*20.)*age*.012;
     gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=(2.+aSeed.y*3.)*uDpr*(1.-.65*clamp(age/3.2,0.,1.));if(age<0.||age>3.2){gl_PointSize=0.;vFade=0.;}}`,
   fragmentShader:`varying vec3 vSeed;varying float vFade;uniform float uTime;void main(){vec2 p=abs(gl_PointCoord*2.-1.);float r=length(p);if(r>1.||vFade<=0.)discard;
    float a=exp(-r*r*14.)+.22*pow(max(0.,1.-max(p.x,p.y)),6.)/(.12+min(p.x,p.y)*9.);vec3 c=mix(vec3(1.,.65,.83),vec3(.58,.9,1.),vSeed.x);if(vSeed.x>.75)c=vec3(1.,.9,.61);
    gl_FragColor=vec4(c,a*vFade*(.7+.3*sin(uTime*5.+vSeed.z*20.)));}`,
  }));this.sparks.frustumCulled=false;this.sparks.renderOrder=5;
  const cp:number[]=[],cs:number[]=[];
  for(let i=0;i<1300;i++){const a=random(i*5)*Math.PI*2,r=Math.sqrt(random(i*5+1));cp.push(Math.cos(a)*r*3.5,1.16+Math.sin(a)*r*1.34,.05+random(i*5+2)*.35);cs.push(random(i*5+3),random(i*5+4));}
  const cg=new BufferGeometry();cg.setAttribute('position',new BufferAttribute(new Float32Array(cp),3));cg.setAttribute('aSeed',new BufferAttribute(new Float32Array(cs),2));
  this.crown=new Points(cg,new ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uOpacity:{value:0},uGrowth:{value:0},uDpr:{value:1}},
   vertexShader:'attribute vec2 aSeed;uniform float uTime,uGrowth,uDpr;varying vec2 vSeed;varying float vGrow;void main(){vSeed=aSeed;vec3 p=position;p.x+=sin(uTime*.5+aSeed.x*40.)*.025;p.y+=cos(uTime*.4+aSeed.y*30.)*.015;vGrow=smoothstep(.32+position.y*.17,.55+position.y*.17,uGrowth);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=(1.+pow(aSeed.x,5.)*3.)*uDpr;}',
   fragmentShader:'uniform float uOpacity,uTime;varying vec2 vSeed;varying float vGrow;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;vec3 c=mix(vec3(.5,.93,1.),vec3(1.,.68,.88),vSeed.y);gl_FragColor=vec4(c,(1.-r*r)*vGrow*uOpacity*.48*(.8+.2*sin(uTime+vSeed.x*30.)));}',
  }));this.crown.frustumCulled=false;this.crown.renderOrder=3;
  this.mist=new Mesh(new PlaneGeometry(6.5,2.8),new ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uOpacity:{value:0}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:noiseGLSL+`varying vec2 vUv;uniform float uTime,uOpacity;void main(){vec2 p=(vUv-.5)*2.;float edge=pow(max(0.,1.-dot(p,p)),3.);float n=fbm(vec3(vUv*5.+vec2(sin(uTime*.11)*.12,cos(uTime*.09)*.08),.7));gl_FragColor=vec4(.55,.69,.83,smoothstep(.48,.72,n)*edge*.055*uOpacity);}`,
  }));this.mist.position.set(0,.8,.05);this.mist.renderOrder=4;
 }
 update(time:number,dt:number,offset:Vector2,butterfly:number,tree:number,growth:number,dpr:number,reduced:boolean){
  if(butterfly>.05){if(!this.wasButterfly)this.last.copy(offset);this.emission+=Math.min(.05,dt)*(reduced?95:160)*butterfly;const n=Math.floor(this.emission);this.emission-=n;
   for(let i=0;i<n;i++){const s=this.serial++,f=(i+1)/n,a=random(s+7),b=random(s+31);const p=new Vector3(this.last.x+(offset.x-this.last.x)*f+(a-.5)*.25,this.last.y+(offset.y-this.last.y)*f-.13+(b-.5)*.18,.12);this.trail.emit(time,p,new Vector3((a-.5)*.035,-.015,(b-.5)*.025),a,b);}this.last.copy(offset);
  }this.wasButterfly=butterfly>.05;
  for(const attr of Object.values(this.sparks.geometry.attributes))attr.needsUpdate=true;
  this.sparks.material.uniforms.uTime.value=time;this.sparks.material.uniforms.uDpr.value=dpr;
  for(const mesh of [this.crown,this.mist]){mesh.visible=tree>.001;const u=mesh.material.uniforms;u.uOpacity.value=tree;if(u.uTime)u.uTime.value=time;if(u.uGrowth)u.uGrowth.value=growth;if(u.uDpr)u.uDpr.value=dpr;}
  this.mist.material.uniforms.uOpacity.value=tree*Math.max(0,(growth-.5)*2);
 }
 dispose(){for(const p of [this.sparks,this.crown,this.mist]){p.geometry.dispose();p.material.dispose();}}
}
