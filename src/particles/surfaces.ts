import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, NormalBlending, ShaderMaterial, Vector3, type IUniform } from 'three';
import { branches, branchPoint, wingPoint } from './geometry';
import { shapeGLSL, noiseGLSL } from './shaders';

// The same parameter buffers and GLSL deformation are used by mesh and particles.
// This makes the particle-to-material handoff spatially continuous.
export function surfaceGeometry(kind:number) {
  const p:number[]=[],butterfly:number[]=[],flower:number[]=[],tree:number[]=[],seed:number[]=[],uv:number[]=[],indices:number[]=[];
  const add=(a:number[],b:number[],c:number[],u:number,v:number)=>{
    p.push(0,0,0);butterfly.push(...a);flower.push(...b);tree.push(...c);seed.push(.5,.5,.5,.5);uv.push(u,v);
  };
  const grid=(rows:number,cols:number,vertex:(u:number,v:number)=>void)=>{
    const base=p.length/3;
    for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)vertex(x/cols,y/rows);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const a=base+y*(cols+1)+x,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);
    }
  };
  if(kind===0){
    for(const side of [-1,1])for(const lower of [false,true])grid(18,70,(u,v)=>add([...wingPoint(u,v,side,lower),1],[0,0,0,0],[0,0,0,0],u,v));
  } else if(kind===1){
    for(let layer=0;layer<5;layer++)for(let petal=0;petal<5+layer*2;petal++){
      const angle=petal*Math.PI*2/(5+layer*2)+layer*.55;
      grid(28,16,(u,v)=>add([0,0,0,0],[angle,v,u*2-1,layer],[0,0,0,0],u,v));
    }
    grid(12,40,(u,v)=>add([0,0,0,0],[u*Math.PI*2,v,0,-2],[0,0,0,0],u,v));
  } else {
    for(const limb of branches()){
      const dir=limb.b.clone().sub(limb.a).normalize();
      const n=new Vector3().crossVectors(dir,new Vector3(0,0,1)).normalize(),b=new Vector3().crossVectors(dir,n);
      grid(16,8,(u,v)=>{
        const r=limb.radius*(1-v*.45),pos=branchPoint(limb,v).addScaledVector(n,Math.cos(u*Math.PI*2)*r).addScaledVector(b,Math.sin(u*Math.PI*2)*r);
        add([0,0,0,0],[0,0,0,0],[pos.x,pos.y,pos.z,limb.start+(limb.end-limb.start)*v],u,v);
      });
    }
  }
  const g=new BufferGeometry();g.setIndex(indices);
  for(const [name,data,size] of [['position',p,3],['aButterfly',butterfly,4],['aFlower',flower,4],['aTree',tree,4],['aSeed',seed,4],['uv',uv,2]] as [string,number[],number][])
    g.setAttribute(name,new BufferAttribute(new Float32Array(data),size));
  return g;
}

const vertex=/* glsl */`
${shapeGLSL}
uniform float uKind;
varying vec2 vUv;
varying vec3 vPosition;
varying float vBorn;
varying float vLayer;
void main(){
  vec4 form=shape(uKind,uControl,uOffset);
  vUv=uv;vBorn=form.w;vPosition=form.xyz;vLayer=aFlower.w;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(form.xyz,1.);
}`;
const fragment=/* glsl */`
precision highp float;
uniform float uTime,uKind,uReveal;
varying vec2 vUv;
varying vec3 vPosition;
varying float vBorn;
varying float vLayer;
${noiseGLSL}
void main(){
  vec3 normal=normalize(cross(dFdx(vPosition),dFdy(vPosition)));
  float light=.45+.55*abs(dot(normal,normalize(vec3(-.4,.8,1.))));
  float silk=pow(.5+.5*sin(vUv.x*210.+sin(vUv.y*8.)*2.),12.);
  float flow=fbm(vec3(vUv*6.,uTime*.16));
  vec3 color;float alpha;
  if(uKind<.5){
    float fog=fbm(vec3(vUv*vec2(12.,4.)+vec2(uTime*.045,-uTime*.08),uTime*.1));
    float edge=smoothstep(.55,1.,vUv.y);
    float veins=pow(.5+.5*sin(vUv.x*94.+sin(vUv.y*10.)*.8),24.);
    color=mix(vec3(.33,.30,.52),vec3(.78,.69,.82),fog);
    color+=vec3(.1,.18,.2)*veins;
    alpha=(.06+fog*.25+edge*fog*.32+veins*.09)*smoothstep(0.,.13,vUv.y);
    alpha*=1.-smoothstep(.93,1.,vUv.y)+.15;
  }else if(uKind<1.5){
    float edge=pow(abs(vUv.x*2.-1.),5.);
    float gold=.90-.05*vLayer;
    color=mix(vec3(.12,.055,.24),vec3(.45,.34,.15),gold)*light;
    color+=vec3(.21,.20,.17)*silk;
    color+=vec3(.36,.27,.10)*edge*.24;
    color+=vec3(.16,.13,.09)*pow(abs(dot(normal,normalize(vec3(.3,.7,1.)))),18.);
    alpha=.20+light*.20+silk*.18+edge*.12;
    alpha*=smoothstep(0.,.045,vUv.y);
    if(vLayer< -1.5){float pollen=noise3(vec3(vUv*90.,2.));color=vec3(.34,.22,.065)*light+pow(pollen,3.)*vec3(.20,.15,.06);alpha=.68;}
  }else{
    float streak=pow(.5+.5*sin(vUv.x*100.+sin(vUv.y*14.+uTime*.3)*3.),16.);
    color=mix(vec3(.009,.025,.04),vec3(.045,.22,.26),light);
    color+=streak*vec3(.10,.35,.43)*.25;
    alpha=.95;
  }
  float dissolve=smoothstep(flow*.35,flow*.35+.65,uReveal);
  if(vBorn<.002||dissolve<.002)discard;
  gl_FragColor=vec4(color,alpha*dissolve*vBorn);
  #include <colorspace_fragment>
}`;

export function createSurface(kind:number,uniforms:Record<string,IUniform>) {
  const geometry=surfaceGeometry(kind);
  const material=new ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{...uniforms,uKind:{value:kind},uReveal:{value:0}},transparent:true,depthWrite:kind===2,side:DoubleSide,blending:NormalBlending});
  const mesh=new Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=kind===2?1:2;
  return mesh;
}
