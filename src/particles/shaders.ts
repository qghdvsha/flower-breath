export const noiseGLSL = /* glsl */`
float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return .57*noise3(p)+.28*noise3(p*2.04+3.7)+.15*noise3(p*4.1+7.3);}
vec3 spectrum(float t){return .55+.45*cos(6.28318*(vec3(.0,.33,.67)+t));}
`;
export const shapeGLSL = /* glsl */`
attribute vec4 aButterfly;
attribute vec4 aFlower;
attribute vec4 aTree;
attribute vec4 aSeed;
uniform float uTime, uFrom, uTo, uMorph, uScatter, uOpacity, uDpr;
uniform vec3 uControl, uOldControl;
uniform vec2 uOffset, uOldOffset;
const float PI = 3.14159265359;
mat3 rotateY(float a) { float s=sin(a),c=cos(a); return mat3(c,0.,-s,0.,1.,0.,s,0.,c); }
mat3 rotateX(float a) { float s=sin(a),c=cos(a); return mat3(1.,0.,0.,0.,c,s,0.,-s,c); }
vec3 colorFor(float kind) {
  if(kind < .5) {
    vec3 tint=.55+.45*cos(6.28318*(vec3(.0,.33,.67)+fract(aSeed.y*6.17+aSeed.z*3.1)));
    return mix(vec3(.8,.64,.93),tint,aSeed.w>.94?.9:.30);
  }
  if(kind < 1.5) {
    vec3 gold=mix(vec3(1.,.60,.22),vec3(1.,.88,.53),aSeed.z);
    if(aSeed.x>.82) gold=mix(gold,vec3(1.,.91,.75),.65);
    if(aSeed.y>.92) gold=mix(gold,vec3(1.,.46,.53),.4);
    return gold;
  }
  float region=.5+.5*sin(aTree.x*1.2+aTree.z*.8);
  vec3 leaf=mix(vec3(.19,.84,.72),vec3(.85,.53,.93),region);
  leaf=mix(leaf,vec3(.95,.85,.45),smoothstep(.73,.98,aSeed.z)*.8);
  return aSeed.x<.28?vec3(.3,.8,.88):leaf;
}
vec4 shape(float kind, vec3 control, vec2 offset) {
  vec3 p; float alpha=1.;
  if(kind < .5) {
    p=aButterfly.xyz;
    if(aButterfly.w>.5 && aButterfly.w<1.5) {
      float flap=.18 + (.5+.5*sin(uTime*5.2))*.88;
      float bend=flap + abs(p.x)*.12*sin(uTime*5.2-.6);
      p.z+=abs(p.x)*sin(bend);
      p.x*=cos(bend);
      p.z+=.035*sin(p.y*12.+uTime*3.);
    }
    if(aButterfly.w>1.5) {
      p.x+=sin(uTime*1.4+aSeed.x*12.)*.28*aSeed.z;
      p.z+=cos(uTime+aSeed.y*14.)*.3;
      alpha=0.;
    }
    p=rotateY(.18+sin(uTime*.43)*.18)*rotateX(-.12)*p;
    p*=1.15;
    p.y+=sin(uTime*1.7)*.035;
    p.xy+=offset;
  } else if(kind < 1.5) {
    float theta=aFlower.x, v=aFlower.y, cross=aFlower.z, layer=aFlower.w;
    if(layer>=0.) {
      float opening=smoothstep(layer*.045,.78+layer*.045,control.x);
      float length=(.72+layer*.21)*(.96+.06*sin(theta*3.+layer));
      float width=pow(max(0.,sin(v*PI)),.55)*(.24+layer*.046)*cross;
      float rClosed=.05+pow(max(0.,sin(v*PI)),.8)*(.29+layer*.025);
      float rOpen=.025+layer*.12+v*length;
      float r=mix(rClosed,rOpen,opening);
      float yClosed=v*1.38-.48+layer*.025;
      float yOpen=.42-layer*.14+sin(v*PI)*(.30+layer*.018)+pow(v,3.)*(.55-layer*.08);
      float y=mix(yClosed,yOpen,opening);
      y+=cross*cross*sin(v*PI)*(.23+layer*.035)*opening;
      float azimuth=theta+.10*sin(v*PI+layer)+cross*v*.07;
      p=vec3(cos(azimuth)*r-sin(azimuth)*width,y,sin(azimuth)*r+cos(azimuth)*width);
      p+=normalize(p+vec3(.001))*(aSeed.x-.5)*.016;
    } else if(layer> -1.5) {
      float h=v*1.35; p=vec3(sin(h*2.)*.04+cos(theta)*.025,-.38-h,sin(theta)*.025);
    } else {
      float r=sqrt(v)*.22; p=vec3(cos(theta)*r,.26-v*.06+aSeed.z*.008,sin(theta)*r);
    }
    p=rotateX(.88)*rotateY(uTime*.16)*p*1.22;
    p.y+=.1;
  } else {
    float born=smoothstep(aTree.w-.075,aTree.w+.045,control.y);
    p=aTree.xyz;
    alpha=born;
    // A living seed remains visible even at the first increment of growth.
    if(aSeed.x<.012){p=vec3(sin(aSeed.y*6.28)*.065,-2.3+aSeed.z*.09,cos(aSeed.y*6.28)*.065);alpha=1.;}
    if(aSeed.x>.985 && control.y<.4){
      float side=aSeed.y>.5?1.:-1.;
      p=vec3(side*sin(aSeed.z*PI)*.32,-1.63+aSeed.z*.18,sin(aSeed.w*6.28)*.08);
      alpha=1.-smoothstep(.22,.4,control.y);
    }else{
      p.xz*=mix(.24,1.,smoothstep(.1,.7,control.y));
    }
    p.x+=sin(uTime*.7+p.y*1.5)*.035*max(0.,p.y+1.1);
    p.z+=cos(uTime*.6+p.x)*.025*max(0.,p.y+1.);
    p=rotateY(control.z)*p;
  }
  return vec4(p,alpha);
}
`;
export const vertexShader = /* glsl */`
${shapeGLSL}
uniform float uSolid,uOldSolid;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 oldShape=shape(uFrom,uOldControl,uOldOffset);
  vec4 newShape=shape(uTo,uControl,uOffset);
  float blend=smoothstep(0.,1.,uMorph);
  vec4 body=mix(oldShape,newShape,blend);
  float scatter=smoothstep(0.,1.,uScatter);
  float theta=aSeed.x*PI*2.+uTime*.13;
  float radial=3.6+aSeed.y*3.9;
  vec3 cloud=vec3(cos(theta)*radial,(aSeed.z-.5)*8.,sin(theta)*radial*.55);
  cloud+=vec3(sin(uTime*.7+aSeed.w*20.),cos(uTime*.5+aSeed.x*20.),sin(uTime*.4+aSeed.y*20.))*.4;
  vec3 p=mix(body.xyz,cloud,scatter);
  // Curved trajectories rather than straight interpolation between shapes.
  p+=sin(scatter*PI)*vec3(sin(theta*3.+uTime),cos(theta*2.+uTime*.7),cos(theta*4.))*.65;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  float jewel=pow(aSeed.w,24.);
  float size=(1.7+aSeed.w*2.2+jewel*20.)*uDpr;
  gl_PointSize=clamp(size*6.5/-mv.z,1.,18.*uDpr);
  vColor=mix(colorFor(uFrom),colorFor(uTo),blend);
  float twinkle=.75+.25*sin(uTime*(.7+aSeed.x)+aSeed.y*40.);
  vAlpha=mix(body.w,.38,scatter)*uOpacity*twinkle*(.58+aSeed.z*.42);
  float solid=mix(uOldSolid,uSolid,blend)*(1.-scatter);
  float species=mix(uFrom,uTo,blend);
  float keep=species<.5?.40:species<1.5?.38:(aSeed.x<.28?.03:1.);
  vAlpha*=mix(1.,keep,solid);
}
`;
export const fragmentShader = /* glsl */`
precision highp float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r=length(gl_PointCoord-.5)*2.;
  if(r>1.)discard;
  float core=exp(-r*r*9.);
  float halo=exp(-r*r*3.)*.22;
  gl_FragColor=vec4(vColor*(.80+core*.4),(core+halo)*vAlpha);
  #include <colorspace_fragment>
}
`;
