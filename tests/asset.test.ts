import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
test('five current assets match user order, preserve source hashes and contain every processed frame',()=>{
 const metadata=JSON.parse(readFileSync('public/videos/hd/source-metadata.json','utf8'));
 const manifest=JSON.parse(readFileSync('public/videos/manifest.json','utf8'));
 const names=['411B5D3D-EAC3-40AE-A92D-F991A319E696.MOV','7E59D0EA-0F13-495C-872A-92FA766DCE8F.MOV','4068CAC9-2AB8-4126-97D2-428C02E7920E.MOV','949918FF-B969-4E66-9C95-19D63B23755F.MOV','lily-final-a.mp4'];
 assert.deepEqual(manifest.map((f:any)=>f.file),names);assert.equal(metadata.length,5);
 for(const m of metadata){
  assert.equal(createHash('sha256').update(readFileSync('public'+m.original)).digest('hex'),m.sha256);
  const spec=manifest.find((f:any)=>f.id===m.id);assert.ok(spec.frames>40);
  assert.equal(spec.sourceWidth??spec.width,m.width);assert.equal(spec.sourceHeight??spec.height,m.height);
  assert.ok(Math.max(spec.closed,spec.open)<m.duration);
  for(let i=0;i<spec.frames;i++){const b=readFileSync(`public${spec.framePath}/${String(i).padStart(3,'0')}.${spec.frameExtension??'jpg'}`);assert.equal(b.readUInt16BE(0),spec.frameExtension==='png'?0x8950:0xffd8);}
 }
});
