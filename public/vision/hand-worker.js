/* Classic worker: MediaPipe 0.10.32 loads its WASM loader with importScripts. */
self.exports = {};
importScripts('/vision/vision-worker-bundle.js');
const { FilesetResolver, HandLandmarker } = self.exports;
let model;
self.onmessage = async ({ data }) => {
 try {
  if (data.type === 'init') {
   const files = await FilesetResolver.forVisionTasks('/vision/wasm');
   model = await HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: '/vision/hand_landmarker.task', delegate: 'CPU' },
    canvas: new OffscreenCanvas(640, 480), runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: .55, minHandPresenceConfidence: .55, minTrackingConfidence: .55,
   });
   self.postMessage({ type: 'ready' });
  } else if (data.type === 'frame' && model) {
   try {
    const start = performance.now();
    const result = model.detectForVideo(data.bitmap, data.time);
    self.postMessage({ type: 'result', landmarks: result.landmarks, handedness: result.handedness, time: data.time, duration: performance.now() - start });
   } finally { data.bitmap.close(); }
  }
 } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
