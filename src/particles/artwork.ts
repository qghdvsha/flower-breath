import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Mesh, Points, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector2, type Texture } from 'three';

// Original files are never rewritten. UVs address their actual photographed pixels.
export const artSpecs = [
  {name:'butterfly',url:'/art/originals/butterfly.jpg',rect:[.16,.20,.88,.71],size:[2.4,3.2],pivot:[.55,.49]},
  {name:'flower',url:'/art/originals/flower.jpg',rect:[-.43,.06,1.43,.94],size:[1.9,4.13],pivot:[.54,.56]},
  {name:'tree',url:'/art/originals/tree.jpg',rect:[0,-.31,1,1],size:[6.7,3.56],pivot:[.5,.36]},
] as const;

const deformation = /* glsl */`
uniform float uTime,uKind,uBloom,uGrowth,uFlap,uOpacity,uScatter,uParticle;
uniform vec2 uOffset,uSize,uPivot;
varying vec2 vUv;varying float vVisibility;
vec3 deform(vec2 q){
 vec3 p=vec3((q-uPivot)*uSize,0.);
 if(uKind<.5){
   float hinge=smoothstep(.018,.065,abs(q.x-uPivot.x));
   float lower=1.-smoothstep(.45,.51,q.y);
   float angle=(.18+.52*(.5+.5*sin(uTime*10.8-lower*.30)))*hinge*uFlap;
   p.z=abs(p.x)*sin(angle);
   p.x*=cos(angle);
   p.y+=sin(uTime*10.8-abs(p.x)*2.)*.018*hinge*uFlap;
   p.y+=sin(uTime*1.8)*.012*uFlap;
 }else if(uKind<1.5){
   // Local petal-sector folds. At bloom=1 every original UV returns EXACTLY to its rest position.
   float r=length(p.xy),theta=atan(p.y,p.x);
   float outer=smoothstep(.16,1.1,r);
   float closed=1.-uBloom;
   float fold=clamp(closed*(1.+.12*sin(theta*7.+r*3.)*uBloom),0.,1.);
   p.x*=1.-fold*outer*.64;
   p.y=mix(p.y,.12+abs(p.y)*.3,fold*outer*.62);
   p.z=fold*outer*(.42+.12*sin(theta*7.))*r;
 }else{
   // Keep trunk fixed; only a tiny canopy sway, never a whole-image zoom.
   p.x+=sin(uTime*.55+q.y*4.)*.012*smoothstep(.35,.8,q.y);
 }
 return p+vec3(uOffset,0.);
}
float growthMask(vec2 q){
 if(uKind<1.5)return 1.;
 float front=uGrowth*1.14;
 float path=q.y+sin(q.x*23.+q.y*11.)*.028*smoothstep(.2,.7,q.y);
 float trunkFirst=smoothstep(.1,.4,uGrowth)+(1.-smoothstep(.045,.12,abs(q.x-.49)))*(1.-smoothstep(-.04,.03,q.y));
 return (1.-smoothstep(front-.045,front+.035,path))*clamp(trunkFirst+step(.025,q.y),0.,1.);
}
`;
const sampling = /* glsl */`
uniform sampler2D uImage,uExtension;
vec3 sourceColor(vec2 q){
 if(uKind>.5&&uKind<1.5){
   // Only the authorized outer repair comes from the generated derivative.
   // Main flower center and all interior petals ALWAYS sample the original JPEG.
   vec2 ext=vec2(.244+q.x*.510,-.077+q.y*1.132);
   vec3 c=texture2D(uExtension,clamp(ext,vec2(0.),vec2(1.))).rgb;
   float fade=smoothstep(-.43,-.34,q.x)*(1.-smoothstep(1.34,1.43,q.x));
   float original=smoothstep(-.012,.065,q.x)*(1.-smoothstep(.935,1.012,q.x))*(1.-smoothstep(.83,.89,q.y));
   return mix(c*fade,texture2D(uImage,clamp(q,vec2(0.),vec2(1.))).rgb,original);
 }
 vec3 c=texture2D(uImage,clamp(q,vec2(0.),vec2(1.))).rgb;
 if(uKind>1.5){
   c*=max(smoothstep(.045,.085,q.y),1.-smoothstep(.042,.09,abs(q.x-.49)));
   if(q.y<.028){
     vec2 rootUv=vec2(q.x+.012,.49+q.y*1.52);
     vec3 roots=texture2D(uExtension,clamp(rootUv,vec2(0.),vec2(1.))).rgb;
     roots*=smoothstep(-.31,-.28,q.y);
     float original=smoothstep(0.,.028,q.y);
     // Remove only the unrelated stage-floor band outside the trunk at the crop edge.
     c*=max(smoothstep(.005,.037,q.y),1.-smoothstep(.042,.09,abs(q.x-.49)));
     c=mix(roots,c,original);
   }
   // Optical black-level key removes the photographed dark-blue rectangle.
   c=max(vec3(0.),c-vec3(.002,.004,.009));
   float light=max(c.r,max(c.g,c.b));
   c*=smoothstep(.008,.038,light);
   c*=smoothstep(0.,.018,q.x)*(1.-smoothstep(.982,1.,q.x))*(1.-smoothstep(.97,1.,q.y));
 }
 return c;
}
`;

export class Artwork {
 readonly mesh:Mesh<BufferGeometry,ShaderMaterial>;
 readonly dust:Points<BufferGeometry,ShaderMaterial>;
 readonly texture:Texture;
 readonly extension:Texture;
 loaded=false;error='';
 constructor(readonly kind:number){
  const spec=artSpecs[kind],loader=new TextureLoader();
  this.texture=loader.load(spec.url,()=>{this.loaded=true;},undefined,()=>{this.error=`素材读取失败：${spec.url}`;});
  this.texture.colorSpace=SRGBColorSpace;
  this.extension=kind>0?loader.load(kind===1?'/art/derived/flower-periphery.png':'/art/derived/tree-roots.png',undefined,undefined,()=>{this.error='补充纹理读取失败';}):this.texture;
  this.extension.colorSpace=SRGBColorSpace;
  const uniforms={uTime:{value:0},uKind:{value:kind},uBloom:{value:1},uGrowth:{value:1},uFlap:{value:1},uOpacity:{value:0},uScatter:{value:0},uParticle:{value:0},
   uOffset:{value:new Vector2()},uSize:{value:new Vector2(...spec.size)},uPivot:{value:new Vector2(...spec.pivot)},uImage:{value:this.texture},uExtension:{value:this.extension},uDpr:{value:1}};
  const nx=kind===1?160:100,ny=kind===1?192:100,positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
   positions.push(x/nx-.5,y/ny-.5,0);
   uvs.push(spec.rect[0]+x/nx*(spec.rect[2]-spec.rect[0]),spec.rect[1]+y/ny*(spec.rect[3]-spec.rect[1]));
   if(x<nx&&y<ny){const a=y*(nx+1)+x;indices.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setAttribute('uv',new BufferAttribute(new Float32Array(uvs),2));g.setIndex(indices);
  this.mesh=new Mesh(g,new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,toneMapped:false,uniforms,
   vertexShader:deformation+`void main(){vUv=uv;vVisibility=growthMask(uv);gl_Position=projectionMatrix*modelViewMatrix*vec4(deform(uv),1.);}`,
   fragmentShader:deformation+sampling+`void main(){vec3 c=sourceColor(vUv);float a=max(c.r,max(c.g,c.b));if(a<.001)discard;
    gl_FragColor=vec4(c,uOpacity*growthMask(vUv));
    #include <colorspace_fragment>
   }`,
  }));
  this.mesh.frustumCulled=false;this.mesh.renderOrder=2;
  this.dust=new Points(g.clone(),new ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{...uniforms,uOpacity:{value:0}},
   vertexShader:deformation+`uniform float uDpr;float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
    void main(){vUv=uv;vVisibility=growthMask(uv);vec3 p=deform(uv);float h=hash(uv);float a=h*6.28318+uScatter*3.;
     p+=vec3(cos(a),sin(a),sin(h*47.))*uScatter*(1.4+h*3.);
     gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=(1.3+h*2.1)*uDpr;}`,
   fragmentShader:deformation+sampling+`void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
    vec3 c=sourceColor(vUv);float a=max(c.r,max(c.g,c.b));if(a<.018)discard;
    gl_FragColor=vec4(c/max(a,.001),a*(1.-r*r)*uOpacity*vVisibility);
    #include <colorspace_fragment>
   }`,
  }));
  // Points must use each vertex once, not the triangle index six times.
  this.dust.geometry.setIndex(null);this.dust.frustumCulled=false;this.dust.renderOrder=3;
 }
 update(t:number,bloom:number,growth:number,offset:Vector2,opacity:number,dustOpacity:number,scatter:number,dpr:number,flap=1){
  for(const object of [this.mesh,this.dust]){
   const u=object.material.uniforms;u.uTime.value=t;u.uBloom.value=bloom;u.uGrowth.value=growth;u.uOffset.value.copy(offset);u.uScatter.value=scatter;u.uDpr.value=dpr;u.uFlap.value=flap;
   u.uOpacity.value=object===this.mesh?opacity:dustOpacity;object.visible=u.uOpacity.value>.001;
  }
 }
 dispose(){this.mesh.geometry.dispose();this.dust.geometry.dispose();this.mesh.material.dispose();this.dust.material.dispose();this.texture.dispose();if(this.extension!==this.texture)this.extension.dispose();}
}
