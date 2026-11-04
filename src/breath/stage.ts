import {Bubbles} from './bubbles';
import {PetalVideo} from './petal-video';
import {BufferAttribute,BufferGeometry,Texture,Color,Mesh,OrthographicCamera,PlaneGeometry,Points,Scene,ShaderMaterial,SRGBColorSpace,Vector2,WebGLRenderer,AdditiveBlending} from 'three';
import {FrameCache,type Flower} from './cache';import {BreathControl} from './control';
const noise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}`;
class Layer {
 textures=[new Texture(),new Texture()];private images:(ImageBitmap|undefined)[]=[];frame=-1;blend=0;uploads=0;
 constructor(){for(const texture of this.textures){texture.colorSpace=SRGBColorSpace;texture.flipY=false;texture.generateMipmaps=true;}}
 draw(f:Flower,p:number,cache:FrameCache){
  const value=p*(f.frames-1),a=Math.floor(value),b=Math.min(f.frames-1,a+1);
  const pair=cache.bracket(f,value);if(!pair)return false;
  // Missing intermediate frames must not blend two very different petal shapes.
  // Adjacent source frames still interpolate smoothly on the GPU.
  const distant=pair.high-pair.low>2;
  const nearest=value-pair.low<=pair.high-value?pair.lower:pair.upper;
  const images=distant?[nearest,nearest]:[pair.lower,pair.upper];
  // Reuse the previous adjacent frame's GPU texture in either direction.
  if(this.images[1]===images[0]||this.images[0]===images[1]){this.textures.reverse();this.images.reverse();}
  // Upload only when decoded source frames change; fractional motion is a shader uniform.
  for(let i=0;i<2;i++)if(this.images[i]!==images[i]){const old=this.textures[i].image as ImageBitmap|undefined;if(old&&(old.width!==images[i].width||old.height!==images[i].height))this.textures[i].dispose();this.images[i]=images[i];this.textures[i].image=images[i];this.textures[i].needsUpdate=true;this.uploads++;}
  this.blend=distant||pair.high===pair.low?0:Math.max(0,Math.min(1,(value-pair.low)/(pair.high-pair.low)));
  this.frame=pair.low;return !!cache.get(f,a)&&!!cache.get(f,b);
 }
 dispose(){this.textures.forEach(t=>t.dispose());this.images=[];}
}
export class BreathStage {
 private petals=new PetalVideo();private bubbles=new Bubbles();private renderer:WebGLRenderer;private scene=new Scene();private camera=new OrthographicCamera(-1,1,1,-1,0,2);
 private layers=[new Layer(),new Layer()];readonly cache=new FrameCache();private mesh:Mesh<PlaneGeometry,ShaderMaterial>;private particles:Points<BufferGeometry,ShaderMaterial>;
 flowers:Flower[]=[];error='';ready=false;private disposed=false;private width=0;private height=0;private time=0;private currentId=-1;private pendingSince=0;private fpsAverage=1/60;private samples=0;reduced=false;
 constructor(canvas:HTMLCanvasElement){
  this.renderer=new WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1));
  this.mesh=new Mesh(new PlaneGeometry(2,2),new ShaderMaterial({depthWrite:false,uniforms:{uA:{value:this.layers[0].textures[0]},uA2:{value:this.layers[0].textures[1]},uB:{value:this.layers[1].textures[0]},uB2:{value:this.layers[1].textures[1]},uFaithfulA:{value:0},uFaithfulB:{value:0},uBubbleMix:{value:0},uBubbleVideo:{value:this.bubbles.texture},uPetals:{value:this.petals.texture},uPetalMix:{value:0},uMixA:{value:0},uMixB:{value:0},uAspect:{value:1},uProgress:{value:0},uTime:{value:0},uTexel:{value:new Vector2(1/1280,1/720)},uDetail:{value:0}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
   fragmentShader:`varying vec2 vUv;uniform sampler2D uA,uA2,uB,uB2,uPetals,uBubbleVideo;uniform float uFaithfulA,uFaithfulB,uBubbleMix;uniform float uPetalMix;uniform float uMixA,uMixB;uniform float uAspect,uProgress,uTime,uDetail;uniform vec2 uTexel;${noise}
   vec3 decodeVideo(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
   vec3 samplePair(sampler2D tex,sampler2D other,float blend,vec2 uv,bool video,float faithful){
    vec3 c=mix(texture2D(tex,uv).rgb,texture2D(other,uv).rgb,blend);return video?decodeVideo(c):c;
   }
   vec3 enhance(sampler2D tex,sampler2D other,float blend,vec2 uv,bool video,float faithful){
    vec3 c=samplePair(tex,other,blend,uv,video,faithful);if(faithful>.5)return c;
    if(uDetail>0.){
     vec3 n=samplePair(tex,other,blend,clamp(uv+vec2(0.,uTexel.y),vec2(0.),vec2(1.)),video,faithful);
     vec3 s=samplePair(tex,other,blend,clamp(uv-vec2(0.,uTexel.y),vec2(0.),vec2(1.)),video,faithful);
     vec3 e=samplePair(tex,other,blend,clamp(uv+vec2(uTexel.x,0.),vec2(0.),vec2(1.)),video,faithful);
     vec3 w=samplePair(tex,other,blend,clamp(uv-vec2(uTexel.x,0.),vec2(0.),vec2(1.)),video,faithful);
     float edge=dot(c-(n+s+e+w)*.25,vec3(.2126,.7152,.0722));
     // Luminance-only detail, noise gate and local bounds avoid colored/white halos.
     float detail=clamp(edge*uDetail*smoothstep(.001,.012,abs(edge)),-.025,.025);
     c=clamp(c+detail,min(c,min(min(n,s),min(e,w))),max(c,max(max(n,s),max(e,w))));
    }
    // Linear-light midtone lift with a white-preserving shoulder; black stays black.
    return c*1.34/(vec3(1.)+c*.34);
   }
   vec3 picture(sampler2D tex,sampler2D other,float blend,vec2 uv,bool video,float faithful){float ratio=1.7777778;vec2 q=uv;if(uAspect>ratio)q.x=(q.x-.5)*uAspect/ratio+.5;else q.y=(q.y-.5)*ratio/uAspect+.5;
    float outside=max(max(-q.x,q.x-1.),max(-q.y,q.y-1.));
    vec2 bg=uv*.85+.075;bg.y=1.-bg.y;vec3 ext=mix(texture2D(tex,bg,6.).rgb,texture2D(other,bg,6.).rgb,blend);
    if(video)ext=decodeVideo(ext);ext*=.42*exp(-max(outside,0.)*.9);q.y=1.-q.y;vec2 imageUV=clamp(q,vec2(0.),vec2(1.));vec3 c=enhance(tex,other,blend,imageUV,video,faithful);
if(faithful>.5)return outside<=0.?c:ext;return mix(c,ext,smoothstep(-.06,.03,outside));}
   void main(){vec2 p=vUv-.5;float dist=length(p*vec2(1.,.85));float grain=noise(vUv*9.)*.11+noise(vUv*24.)*.025;
    float threshold=uProgress*.95-.14;float incoming=1.-smoothstep(threshold-.035,threshold+.035,dist+grain);if(uProgress<=0.)incoming=0.;if(uProgress>=1.)incoming=1.;
    vec3 c=picture(uA,uA2,uMixA,vUv,false,uFaithfulA);if(incoming>0.)c=mix(c,picture(uB,uB2,uMixB,vUv,false,uFaithfulB),incoming);if(uPetalMix>0.)c=mix(c,picture(uPetals,uPetals,0.,vUv,true,0.),uPetalMix);if(uBubbleMix>0.)c=mix(c,picture(uBubbleVideo,uBubbleVideo,0.,vUv,true,1.),uBubbleMix);gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
   }`,
  }));this.scene.add(this.mesh);
  const p=new Float32Array(1000*3),seeds=new Float32Array(1000*3);for(let i=0;i<1000;i++){const r=(n:number)=>Math.sin(n*127.1)*43758.5453%1;seeds.set([Math.abs(r(i+1)),Math.abs(r(i+31)),Math.abs(r(i+155))],i*3);}
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(p,3));g.setAttribute('aSeed',new BufferAttribute(seeds,3));
  this.particles=new Points(g,new ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:AdditiveBlending,uniforms:{uTime:{value:0},uProgress:{value:0},uActive:{value:0},uDpr:{value:1},uAspect:{value:1},uColor:{value:new Color('#b9dfff')}},
   vertexShader:`attribute vec3 aSeed;uniform float uTime,uProgress,uActive,uDpr,uAspect;varying float vAlpha;void main(){float theta=aSeed.x*6.28318+uTime*.06;
    float pulse=sin(uProgress*3.14159);float radius=.10+aSeed.y*.32+pulse*(.3+aSeed.z*.45);theta+=pulse*.65;
    vec2 p=vec2(cos(theta),sin(theta))*radius;p.x/=max(uAspect,1.);p.y+=sin(uTime*.5+aSeed.x*20.)*.025;
    gl_Position=vec4(p,0.,1.);gl_PointSize=(1.+pow(aSeed.z,4.)*4.)*uDpr;
    vAlpha=(uActive*pulse*.75+(1.-uActive)*step(.96,aSeed.y)*.12)*(.6+.4*sin(uTime*1.3+aSeed.x*50.));}`,
   fragmentShader:'uniform vec3 uColor;varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(uColor,(1.-r*r)*vAlpha);}',
  }));this.particles.frustumCulled=false;this.particles.renderOrder=2;this.scene.add(this.particles);
  void this.loadManifest();
 }
 private async loadManifest(){try{const r=await fetch('/videos/manifest.json');if(!r.ok)throw new Error('视频清单未就绪，请重试素材');const data=await r.json();if(!Array.isArray(data)||data.length<1)throw new Error('视频清单内容不完整');if(!this.disposed)this.flowers=data;}catch(e){if(!this.disposed)this.error=e instanceof Error?e.message:String(e);}}
 render(control:BreathControl,dt:number){
  this.time+=Math.min(dt,.1);if(innerWidth!==this.width||innerHeight!==this.height){this.width=innerWidth;this.height=innerHeight;this.renderer.setSize(this.width,this.height,false);this.mesh.material.uniforms.uAspect.value=this.width/this.height;}
  this.fpsAverage+=(dt-this.fpsAverage)*.025;if(++this.samples%240===0&&this.fpsAverage>.032&&!this.reduced){this.reduced=true;this.renderer.setPixelRatio(1);this.renderer.setSize(this.width,this.height,false);this.particles.geometry.setDrawRange(0,500);this.mesh.material.uniforms.uDetail.value=0;}
  if(this.flowers.length>0&&!this.error){
   if(this.currentId!==control.index){if(this.currentId>=0&&control.index===control.next&&control.progress===1)this.layers.reverse();this.currentId=control.index;}
   control.flowerCount=this.flowers.length;const current=this.flowers[control.index],next=this.flowers[control.phase==='idle'?(control.index+1)%this.flowers.length:control.next];
   const requests:{flower:Flower;frame:number}[]=[];
   const currentFrame=Math.floor(control.aperture*(current.frames-1));
   for(const offset of [0,1,-1,2,-2,3])requests.push({flower:current,frame:Math.max(0,Math.min(current.frames-1,currentFrame+offset))});
   // Decode the latest finger destination before distant speculative neighbours.
   const targetFrame=Math.floor(control.target*(current.frames-1));
   requests.splice(2,0,{flower:current,frame:targetFrame},{flower:current,frame:Math.min(targetFrame+1,current.frames-1)});
   // While idle, keep a small fixed preview of the next flower instead of decoding it on every pinch.
   const upcoming=control.phase==='idle'?.65:control.aperture;
   const nextFrame=Math.floor(upcoming*(next.frames-1));
   const nextRequests=[{flower:next,frame:nextFrame},{flower:next,frame:Math.min(nextFrame+1,next.frames-1)}];
   if(control.phase!=='idle')requests.splice(2,0,...nextRequests);else requests.push(...nextRequests);
   this.cache.request(requests);this.ready=this.layers[0].draw(current,control.aperture,this.cache);
   const nextReady=control.phase!=='idle'&&this.layers[1].draw(next,control.aperture,this.cache);
   if(control.phase==='loading'){if(!this.pendingSince)this.pendingSince=this.time;if(nextReady){control.beginTransition();this.pendingSince=0;}else if(this.time-this.pendingSince>8){this.error='下一段素材加载超时，请重试';control.failTransition();this.pendingSince=0;}}
   else this.pendingSince=0;
   if(this.cache.error)this.error=this.cache.error;
   const uniforms=this.mesh.material.uniforms;uniforms.uTexel.value.set(1/current.width,1/current.height);uniforms.uFaithfulA.value=current.id===5?1:0;uniforms.uFaithfulB.value=next.id===5?1:0;
   uniforms.uA.value=this.layers[0].textures[0];uniforms.uA2.value=this.layers[0].textures[1];uniforms.uMixA.value=this.layers[0].blend;
   uniforms.uB.value=this.layers[1].textures[0];uniforms.uB2.value=this.layers[1].textures[1];uniforms.uMixB.value=this.layers[1].blend;
   this.mesh.material.uniforms.uProgress.value=control.phase==='transition'?control.progress:0;
   const u=this.particles.material.uniforms;u.uTime.value=this.time;u.uProgress.value=control.progress;u.uActive.value=control.phase==='transition'?1:0;u.uDpr.value=this.renderer.getPixelRatio();u.uAspect.value=this.width/this.height;u.uColor.value.set(current.color);if(control.phase==='transition')u.uColor.value.lerp(new Color(next.color),control.progress);
  }
  this.bubbles.update(control,dt);this.mesh.material.uniforms.uBubbleMix.value=this.bubbles.mix;this.petals.update(control,dt);this.mesh.material.uniforms.uPetalMix.value=this.petals.mix;this.renderer.render(this.scene,this.camera);
 }
 get diagnostics(){return {bubbles:this.bubbles.diagnostics,petals:this.petals.diagnostics,ready:this.ready,...this.cache.diagnostics,textures:this.renderer.info.memory.textures,geometries:this.renderer.info.memory.geometries,frame:this.layers[0].frame,textureUploads:this.layers.reduce((n,l)=>n+l.uploads,0),interpolation:"GPU",detailEnhancement:this.mesh.material.uniforms.uDetail.value>0,error:this.error,reduced:this.reduced};}
 retry(){this.error='';this.cache.clearError();this.pendingSince=0;if(this.flowers.length===0)void this.loadManifest();}
 dispose(){this.disposed=true;this.bubbles.dispose();this.petals.dispose();this.cache.dispose();this.layers.forEach(l=>l.dispose());this.mesh.geometry.dispose();this.mesh.material.dispose();this.particles.geometry.dispose();this.particles.material.dispose();this.renderer.dispose();}
}
