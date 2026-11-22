import test from 'node:test';
import assert from 'node:assert/strict';
import { PresageSource } from '../web/adapters/presage.js';

globalThis.window = { __smartspectraBridge: true };
const states = { kIdle: 1, kStarting: 2, kRunning: 3, kStopping: 4, kError: 5 };
function fixture({ stopPromise, failStop = false, loadRuntime, getUserMedia, cameraFrameRate = 30 } = {}) {
 const events = [], instances = [], errors = [], samples = [], streams = [], cameraRequests = [], captured = [], cameraSettings = [], statuses = [];
 const acquire = getUserMedia || (async constraints => {
  cameraRequests.push(constraints);
  const track = { readyState: "live", stop() { events.push("stop-track"); this.readyState = "ended"; }, getSettings() { return {width:640,height:480,frameRate:cameraFrameRate,deviceId:"private-device"}; } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  captured.push(stream);
  return stream;
 });
 class SDK {
  constructor(options) { this.options = options; this.handlers = new Map(); this.stops = 0; this.destroyed = false; instances.push(this); events.push('construct'); }
  on(name, fn) { this.handlers.set(name, fn); }
  emit(name, ...args) { this.handlers.get(name)?.(...args); }
  useMediaStream(stream) { this.stream = stream; events.push('use-stream'); }
  async start() {
   assert.ok(this.stream, 'SDK must use the host camera rather than acquire its default 720p feed');
   events.push('start');
   this.track = this.stream.getVideoTracks()[0];
   this.emit('processingStatus', states.kIdle);
   this.emit('processingStatus', states.kStarting);
   this.emit('processingStatus', states.kRunning);
  }
  stop() { this.stops++; events.push('stop-frame-pump'); this.emit('processingStatus', states.kStopping); return failStop ? Promise.reject(Error('stop failed')) : stopPromise || Promise.resolve(); }
  destroy() { events.push('destroy'); this.destroyed = true; }
 }
 const runtime = { SmartSpectraSDK: SDK, MetricType: { FACE_LANDMARKS: 11 }, ProcessingStatus: states, decodeMetrics: value => value };
 const source = new PresageSource({
  onStream: value => streams.push(value), onSample: value => samples.push(value),
  onCameraSettings: value => cameraSettings.push(value),
  onStatus: (hint, details) => statuses.push({hint,details}), onError: (message, details) => errors.push({ message, details })
 }, { loadRuntime: loadRuntime || (async () => runtime), getUserMedia: acquire });
 return { source, runtime, events, instances, errors, samples, streams, cameraRequests, captured, cameraSettings, statuses };
}

test('live startup requests landmarks only and ignores the initial idle transition', async () => {
 const f = fixture(); await f.source.start(' private-test-key ');
 assert.equal(f.instances[0].options.apiKey, 'private-test-key');
 assert.deepEqual(f.instances[0].options.requestedMetrics, [11]);
 assert.equal(f.instances[0].options.enableTelemetry, false);
 assert.equal(f.errors.length, 0);
 f.instances[0].emit('metrics', { face: { landmarks: [{ timestamp: 123 }] } });
 assert.equal(f.samples.length, 1);
 await f.source.stop();
});

test('SDK frame pump stops before original tracks and deliberate stop emits no failure', async () => {
 const f = fixture(); await f.source.start('test');
 await f.source.stop();
 assert.deepEqual(f.events.slice(-3), ['stop-frame-pump', 'stop-track', 'destroy']);
 assert.equal(f.errors.length, 0);
 assert.equal(f.source.sdk, null);
 assert.equal(f.source.stream, null);
});

test('unexpected native idle reports one recoverable interruption and ignores later samples', async () => {
 const f = fixture(); await f.source.start('test');
 const sdk = f.instances[0];
 sdk.emit('processingStatus', states.kIdle);
 sdk.emit('error', 1, 'invalid state', true);
 sdk.emit('metrics', { face: { landmarks: [{ timestamp: 123 }] } });
 assert.equal(f.errors.length, 1);
 assert.match(f.errors[0].message, /processing stopped/);
 assert.equal(f.samples.length, 0);
 await f.source.stop();
});

test('native errors retain their code and retryability without exposing the key', async () => {
 const f = fixture(); await f.source.start('private-test-key');
 f.instances[0].emit('error', 14, 'Frame rate too low.', true);
 assert.deepEqual(f.errors, [{ message: 'Frame rate too low.', details: { code: 14, retryable: true } }]);
 assert.equal(JSON.stringify(f.errors).includes('private-test-key'), false);
 await f.source.stop();
});

test('a new session waits for the previous asynchronous stop and destroy', async () => {
 let release;
 const stopPromise = new Promise(resolve => { release = resolve; });
 const f = fixture({ stopPromise }); await f.source.start('test');
 const stopping = f.source.stop(), starting = f.source.start('test');
 await Promise.resolve(); await Promise.resolve();
 assert.equal(f.instances.length, 1);
 release(); await stopping; await starting;
 assert.equal(f.instances.length, 2);
 assert.ok(f.events.indexOf('destroy') < f.events.lastIndexOf('construct'));
 await f.source.stop();
});

test('a failed stop still destroys the session and allows a later reconnect', async () => {
 const f = fixture({ failStop: true }); await f.source.start('test');
 await f.source.stop();
 assert.equal(f.instances[0].destroyed, true);
 await f.source.start('test');
 assert.equal(f.instances.length, 2);
 await f.source.stop();
});

test('a cancelled runtime load cannot stop a newer session', async () => {
 let release, count = 0, loaded;
 const pending = new Promise(resolve => { release = resolve; });
 const f = fixture({ loadRuntime: async () => { count++; return count === 1 ? pending : f.runtime; } });
 loaded = f.source.start('test');
 while (count === 0) await Promise.resolve();
 const next = f.source.start('test');
 await next;
 const current = f.source.sdk;
 release(f.runtime); await loaded;
 assert.equal(f.source.sdk, current);
 assert.equal(current.stops, 0);
 await f.source.stop();
});

test('callbacks from a retired SDK cannot clear a replacement stream', async () => {
 const f = fixture(); await f.source.start('test');
 const retired = f.instances[0];
 await f.source.start('test');
 const currentStream = f.source.stream;
 retired.emit('error', 1, 'late failure', true);
 retired.emit('processingStatus', states.kIdle);
 retired.emit('metrics', { face: { landmarks: [{ timestamp: 123 }] } });
 assert.equal(f.source.stream, currentStream);
 assert.equal(f.errors.length, 0);
 assert.equal(f.samples.length, 0);
 await f.source.stop();
});

test('an error during startup retains its original explanation', async () => {
 const f = fixture();
 class FailingSDK extends f.runtime.SmartSpectraSDK {
  async start() { await super.start(); this.emit('error', 2, 'Authentication could not complete.', false); }
 }
 f.runtime.SmartSpectraSDK = FailingSDK;
 await assert.rejects(f.source.start('test'), /Authentication could not complete/);
 assert.equal(f.instances[0].destroyed, true);
});

test('one smaller 30-fps camera feed is shared with the SDK and preview', async () => {
 const f = fixture(); await f.source.start('test');
 assert.equal(f.cameraRequests.length, 1);
 const constraints = f.cameraRequests[0];
 assert.equal(constraints.audio, false);
 assert.equal(constraints.video.width.max, 640);
 assert.equal(constraints.video.height.max, 480);
 assert.equal(constraints.video.frameRate.ideal, 30);
 assert.equal(constraints.video.frameRate.min, 25);
 assert.equal(f.instances[0].stream, f.captured[0]);
 assert.equal(f.streams[0], f.captured[0]);
 assert.ok(f.events.indexOf('use-stream') < f.events.indexOf('start'));
 assert.deepEqual(f.cameraSettings, [{ width: 640, height: 480, frameRate: 30 }]);
 assert.equal(JSON.stringify(f.cameraSettings).includes('private-device'), false);
 await f.source.stop();
});

test('a camera reporting 15 fps is released before starting native measurement', async () => {
 const f = fixture({ cameraFrameRate: 15 });
 await assert.rejects(f.source.start('test'), /15 fps/);
 assert.equal(f.instances.length, 0);
 assert.equal(f.captured[0].getVideoTracks()[0].readyState, 'ended');
 assert.equal(f.source.stream, null);
});

test('native frame-rate warnings and recovery keep their validation codes', async () => {
 const f = fixture(); await f.source.start('test');
 f.instances[0].emit('validationStatus', 11, 123, 'Camera frame rate is too low.');
 assert.deepEqual(f.statuses.at(-1), { hint: 'Camera frame rate is too low.', details: { validationCode: 11 } });
 f.instances[0].emit('validationStatus', 0, 124, '');
 assert.deepEqual(f.statuses.at(-1), { hint: '', details: { validationCode: 0 } });
 assert.equal(f.errors.length, 0);
 await f.source.stop();
});

test('a cancelled camera permission request releases its late stream without replacing a new feed', async () => {
 let release, requests = 0;
 const camera = () => {
  const track = { readyState: 'live', stop() { this.readyState = 'ended'; }, getSettings: () => ({width:640,height:480,frameRate:30}) };
  return { getTracks: () => [track], getVideoTracks: () => [track] };
 };
 const oldStream = camera(), nextStream = camera();
 const f = fixture({ getUserMedia: () => ++requests === 1 ?
  new Promise(resolve => { release = resolve; }) : Promise.resolve(nextStream) });
 const first = f.source.start('test');
 while (requests === 0) await Promise.resolve();
 await f.source.stop();
 await f.source.start('test');
 release(oldStream); await first;
 assert.equal(f.source.stream, nextStream);
 assert.equal(nextStream.getVideoTracks()[0].readyState, 'live');
 assert.equal(oldStream.getVideoTracks()[0].readyState, 'ended');
 await f.source.stop();
});

test('denied camera permission never starts a native session', async () => {
 const denied = Object.assign(Error('Permission declined'), { name: 'NotAllowedError' });
 const f = fixture({ getUserMedia: async () => { throw denied; } });
 await assert.rejects(f.source.start('test'), error => error === denied);
 assert.equal(f.instances.length, 0);
 assert.equal(f.source.stream, null);
});
