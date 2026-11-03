import { BackSide, BufferAttribute, BufferGeometry, Mesh, Points, ShaderMaterial, SphereGeometry } from 'three';
import { noiseGLSL } from './shaders';
import { random } from './geometry';

export class Cosmos {
  readonly nebula:Mesh<SphereGeometry,ShaderMaterial>;
  readonly stars:Points<BufferGeometry,ShaderMaterial>;
  constructor(){
    this.nebula=new Mesh(new SphereGeometry(45,32,20),new ShaderMaterial({side:BackSide,depthWrite:false,
      uniforms:{uTime:{value:0}},
      vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:/* glsl */`
      precision highp float;uniform float uTime;varying vec3 vDirection;
      ${noiseGLSL}
      void main(){
        vec3 p=normalize(vDirection);float drift=uTime*.004;
        float warp=fbm(p*3.+drift);
        float mist=fbm(p*7.+warp*2.+vec3(drift,0.,0.));
        float band=exp(-pow((p.y+.23*sin(p.x*4.))/.23,2.));
        float cloud=pow(mist,3.)*band;
        vec3 color=vec3(.003,.005,.014);
        color+=mix(vec3(.018,.012,.05),vec3(.006,.035,.06),warp)*cloud*2.6;
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`,
    }));
    this.nebula.renderOrder=-10;
    const p=new Float32Array(3500*3),seed=new Float32Array(3500*2);
    for(let i=0;i<3500;i++){
      const angle=random(i*5)*Math.PI*2,z=random(i*5+1)*2-1,r=18+random(i*5+2)*22;
      p.set([Math.cos(angle)*Math.sqrt(1-z*z)*r,z*r,Math.sin(angle)*Math.sqrt(1-z*z)*r],i*3);
      seed.set([random(i*5+3),random(i*5+4)],i*2);
    }
    const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(p,3));g.setAttribute('aSeed',new BufferAttribute(seed,2));
    this.stars=new Points(g,new ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uDpr:{value:1}},
      vertexShader:'attribute vec2 aSeed;uniform float uTime,uDpr;varying vec2 vSeed;void main(){vSeed=aSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=(1.+pow(aSeed.x,8.)*4.)*uDpr;}',
      fragmentShader:'uniform float uTime;varying vec2 vSeed;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float a=exp(-r*r*5.)*(.3+.4*vSeed.x)*(.8+.2*sin(uTime*.4+vSeed.y*30.));gl_FragColor=vec4(mix(vec3(.55,.66,.92),vec3(.95,.83,.7),vSeed.y),a);}',
    }));this.stars.renderOrder=-9;
  }
  update(t:number,dpr:number){this.nebula.material.uniforms.uTime.value=t;this.stars.material.uniforms.uTime.value=t;this.stars.material.uniforms.uDpr.value=dpr;this.stars.rotation.y=t*.0008;}
  dispose(){this.nebula.geometry.dispose();this.nebula.material.dispose();this.stars.geometry.dispose();this.stars.material.dispose();}
}
