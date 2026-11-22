import { NativePresageSource } from './native-presage.js';
export const desktopAvailable = () => Boolean(globalThis.window?.__inflectNativeCamera || globalThis.window?.__smartspectraBridge);
export const LIVE_CAMERA_CONSTRAINTS = Object.freeze({
 audio: false,
 video: Object.freeze({
  facingMode: 'user',
  width: Object.freeze({ ideal: 640, max: 640 }),
  height: Object.freeze({ ideal: 480, max: 480 }),
  frameRate: Object.freeze({ ideal: 30, min: 25, max: 30 })
 })
});

export class PresageSource {
 constructor(callbacks, {
  nativeBridge = globalThis.window?.__inflectNativeCamera,
  loadRuntime = () => import('../runtime/presage.js'),
  getUserMedia = constraints => globalThis.navigator.mediaDevices.getUserMedia(constraints)
 } = {}) {
  Object.assign(this, callbacks);
  this.native = nativeBridge ? new NativePresageSource(callbacks, { bridge: nativeBridge }) : null;
  this.loadRuntime = loadRuntime;
  this.getUserMedia = getUserMedia;
  this.sdk = null;
  this.stream = null;
  this.generation = 0;
  this.stopping = Promise.resolve();
 }

 async start(key) {
  if (this.native) return this.native.start(key);
  if (!desktopAvailable()) throw Error('Live feedback requires the desktop studio. Use mirror practice in this browser.');
  if (!key?.trim()) throw Error('Enter your Presage API key.');
  await this.stop();
  const generation = ++this.generation;
  const { SmartSpectraSDK, MetricType, ProcessingStatus, decodeMetrics } = await this.loadRuntime();
  if (generation !== this.generation) return;
  let failed = false, failureMessage = '';
  try {
   // Own one smaller camera feed and share it with the SDK and preview.
   // Keep the SDK's required frame rate; only the spatial resolution is reduced.
   const stream = await this.getUserMedia(LIVE_CAMERA_CONSTRAINTS);
   if (generation !== this.generation) {
    stream.getTracks().forEach(track => track.stop());
    return;
   }
   this.stream = stream;
   const settings = stream.getVideoTracks()[0]?.getSettings?.() || {};
   const camera = Object.fromEntries(['width', 'height', 'frameRate']
    .filter(name => Number.isFinite(settings[name]))
    .map(name => [name, settings[name]]));
   this.onCameraSettings?.(camera);
   if (Number.isFinite(camera.frameRate) && camera.frameRate < 25) {
    throw Error(`The camera reports ${camera.frameRate} fps. Live feedback needs about 25 fps or more. Improve front lighting and close busy apps before reconnecting.`);
   }
   const sdk = this.sdk = new SmartSpectraSDK({
    apiKey: key.trim(),
    requestedMetrics: [MetricType.FACE_LANDMARKS],
    enableTelemetry: false,
    enableAccumulatedOutput: false
   });
   const current = () => generation === this.generation && this.sdk === sdk;
   let running = false;
   const fail = (message, details = {}) => {
    if (!current() || failed) return;
    failed = true;
    failureMessage = message || 'Presage could not continue. Reconnect to try again.';
    this.onError?.(failureMessage, details);
   };
   sdk.on('metrics', buffer => {
    if (!current() || failed) return;
    try {
     const data = decodeMetrics(buffer);
     for (const frame of data?.face?.landmarks || []) this.onSample?.(frame);
    } catch {
     this.onStatus?.('Measurement unavailable');
    }
   });
   sdk.on('validationStatus', (code, _ts, hint) => {
    if (current() && !failed) this.onStatus?.(hint || '', { validationCode: code });
   });
   sdk.on('processingStatus', status => {
    if (!current() || failed) return;
    const states = ProcessingStatus || { kIdle: 1, kStarting: 2, kRunning: 3, kStopping: 4, kError: 5 };
    if (status === states.kRunning) running = true;
    if (status === states.kStarting) this.onStatus?.('Presage is starting. Wait for clear tracking before capturing.');
    if (status === states.kError || running && (status === states.kIdle || status === states.kStopping)) {
     fail('Presage processing stopped. Reconnect live feedback to calibrate again.', { status });
    }
   });
   sdk.on('error', (code, message, retryable) => fail(message, { code, retryable }));
   sdk.useMediaStream(stream);
   this.onStream?.(stream);
   await sdk.start();
  } catch (error) {
   if (generation === this.generation) await this.stop();
   throw error;
  }
  if (generation !== this.generation) return;
  if (failed) {
   await this.stop();
   throw Error(failureMessage || 'Presage could not start. Reconnect to try again.');
  }
 }

 stop() {
  if (this.native) return this.native.stop();
  this.generation++;
  const sdk = this.sdk, stream = this.stream;
  this.sdk = null;
  this.stream = null;
  if (!sdk) {
   stream?.getTracks().forEach(track => track.stop());
   return this.stopping;
  }
  let stopped;
  try { stopped = sdk.stop(); } catch (error) { stopped = Promise.reject(error); }
  stream?.getTracks().forEach(track => track.stop());
  const cleanup = Promise.resolve(stopped).finally(() => sdk.destroy());
  this.stopping = Promise.allSettled([this.stopping, cleanup]).then(() => {});
  return this.stopping;
 }
}
