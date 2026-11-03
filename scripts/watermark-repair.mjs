// Spatial background reconstruction from THIS frame only. No frozen donor frames.
// Regions are deliberately restricted to background, not the main flower.
export function repairWatermark(p,width,height,region){
 const [ax,ay,bx,by]=region;
 const x0=Math.round(ax*width/1280),x1=Math.min(width-1,Math.round(bx*width/1280));
 const y0=Math.round(ay*height/720),y1=Math.min(height-1,Math.round(by*height/720));
 const original=new Uint8ClampedArray(p),feather=10*width/1280;
 // Solve a low-resolution 2D harmonic field from the clean surrounding boundary.
 // Unlike copying columns, this does not extend branches into vertical streaks.
 const nx=Math.ceil((x1-x0)/4)+1,ny=Math.ceil((y1-y0)/4)+1,field=new Float32Array(nx*ny*3);
 const sample=(x,y,ch)=>original[(Math.max(0,Math.min(height-1,Math.round(y)))*width+Math.max(0,Math.min(width-1,Math.round(x))))*4+ch];
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)for(let ch=0;ch<3;ch++){
  const x=x0+i/(nx-1)*(x1-x0),y=y0+j/(ny-1)*(y1-y0),k=(j*nx+i)*3+ch;
  const cleanBoundary=j===0||j===ny-1||(i===0&&x0>0)||(i===nx-1&&x1<width-1);
  field[k]=cleanBoundary?sample(x,y,ch):sample(x,y0,ch)*(1-j/(ny-1))+sample(x,y1,ch)*j/(ny-1);
 }
 for(let pass=0;pass<240;pass++)for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++)for(let ch=0;ch<3;ch++){
  const k=(j*nx+i)*3+ch;field[k]+=(.25*(field[k-3]+field[k+3]+field[k-nx*3]+field[k+nx*3])-field[k])*1.5;
 }
 for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
   const gx=(x-x0)/(x1-x0)*(nx-1),gy=(y-y0)/(y1-y0)*(ny-1),ix=Math.min(nx-2,Math.floor(gx)),iy=Math.min(ny-2,Math.floor(gy)),fx=gx-ix,fy=gy-iy,k=(y*width+x)*4;
   let a=Math.min(1,(y-y0)/feather,(y1-y)/feather);
   if(x0>0)a=Math.min(a,(x-x0)/feather);if(x1<width-1)a=Math.min(a,(x1-x)/feather);
   a=Math.max(0,a);a=a*a*(3-2*a);
   for(let ch=0;ch<3;ch++){const n=(iy*nx+ix)*3+ch,value=(field[n]*(1-fx)+field[n+3]*fx)*(1-fy)+(field[n+nx*3]*(1-fx)+field[n+nx*3+3]*fx)*fy;p[k+ch]=original[k+ch]*(1-a)+value*a;}
 }
}
