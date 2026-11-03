import {mkdir,cp,writeFile} from 'node:fs/promises';
await mkdir('public/vision',{recursive:true});
await cp('node_modules/@mediapipe/tasks-vision/wasm','public/vision/wasm',{recursive:true});
await cp('node_modules/@mediapipe/tasks-vision/vision_bundle.cjs','public/vision/vision-worker-bundle.js');
const response=await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');
if(!response.ok) throw new Error(`模型下载失败 ${response.status}`);
await writeFile('public/vision/hand_landmarker.task',Buffer.from(await response.arrayBuffer()));
console.log('本地 WASM 和手部模型准备完成。');
