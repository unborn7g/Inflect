import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { LandmarkGate, buildCalibration, classifyBrow, FACE_POINTS } from '../web/lib/signal.js';
import { PracticeClock } from '../web/lib/session.js';

const app = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
function stream() {
 const track = { readyState: 'live', stops: 0, stop() { this.readyState = 'ended'; this.stops++; } };
 return { track, getTracks: () => [track], getVideoTracks: () => [track] };
}
function fixture() {
 const elements = new Map(), timers = new Map(), listeners = new Map(), messages = [], sources = [];
 let time = 1000, nextTimer = 0;
 class Element {
  constructor(id) { this.id = id; this.open = false; this.style = {}; this.dataset = {}; this.disabled = false; this.checked = true; this.value = 'test-key'; this.textContent = ''; this.tagName = 'BODY'; this.classList = { toggle() {} }; }
  set innerHTML(value) { this.html = value; if (this.id === '#modal' && elements.has('#capture-button')) elements.get('#capture-button').disabled = false; }
  get innerHTML() { return this.html || ''; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() {}
  addEventListener() {}
  setAttribute() {}
  querySelectorAll() { return []; }
  play() { return Promise.resolve(); }
 }
 const get = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
 class Source {
  constructor(callbacks) { this.callbacks = callbacks; this.stream = stream(); this.stops = 0; sources.push(this); }
  async start() { this.callbacks.onStream(this.stream); }
  async stop() { this.stops++; }
 }
 const context = vm.createContext({
  console: { error() {} }, performance: { now: () => time }, Date, Promise,
  setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
  clearTimeout(id) { timers.delete(id); }, requestAnimationFrame() {},
  document: { hidden: false, activeElement: get('active'), querySelector: get, addEventListener(name, fn) { listeners.set(name, fn); } },
  window: { addEventListener() {}, scrollTo() {} },
  navigator: { mediaDevices: { getUserMedia: async () => stream() } },
  VoiceGuide: class { stop() {} speak() {} activate() {} },
  LandmarkGate, PracticeClock, buildCalibration, classifyBrow, FACE_POINTS, drawLandmarks() {},
  PresageSource: Source, desktopAvailable: () => true,
  icon: () => '', browIcon: () => '', faceIllustration: () => '<svg></svg>', setFaceState() {},
  readHistory: () => []
 });
 const body = app.replace(/^import .*;\r?\n/gm, '').replace(/\nrender\(\);\nrequestAnimationFrame\(tick\);\s*$/, '\n');
 vm.runInContext(body + `
  render = () => {};
  update = () => {};
  toast = message => messages.push(message);
  globalThis.api = { s, calibration, action, tick, stopCamera, interruptCamera, attach, startCamera, consent, handleSample,
   modalPurpose: () => modalPurpose };
 `, Object.assign(context, { messages }));
 const api = context.api;
 function live() {
  const camera = stream(), source = { stops: 0, async stop() { this.stops++; } };
  Object.assign(api.s, { mode: 'live', status: 'ready', stream: camera, source, calStep: 0, calSamples: { neutral: [], raised: [], furrowed: [] } });
  api.s.gate.fresh = () => true;
  api.calibration();
  return { camera, source };
 }
 return { api, get, live, timers, listeners, sources, messages, Source, document: context.document, navigator: context.navigator,
  advance(ms) { time += ms; return time; },
  runTimer(id) { const fn = timers.get(id); timers.delete(id); fn?.(); }
 };
}

test('all three calibration poses retain one live camera and SDK session', async () => {
 const f = fixture(), { camera, source } = f.live();
 const features = [[.2,.2,.3], [.3,.3,.3], [.12,.12,.2]];
 for (let step = 0; step < 3; step++) {
  assert.equal(f.api.s.calStep, step);
  await f.api.action('capture', f.get('#capture-button'));
  f.api.s.capture.features = Array.from({ length: 25 }, () => features[step]);
  f.api.tick(f.advance(3200));
  assert.equal(f.api.s.stream, camera);
  assert.equal(camera.track.stops, 0);
  assert.equal(source.stops, 0);
 }
 assert.equal(f.api.s.cal.ok, true);
 assert.equal(f.get('#modal').open, false);
 assert.equal(f.api.s.capture, null);
 assert.equal(f.timers.size, 0);
});

test('SDK interruption closes the disabled calibration dialog and cancels its capture timer', async () => {
 const f = fixture(), { camera, source } = f.live();
 await f.api.action('capture', f.get('#capture-button'));
 const capture = f.api.s.capture, staleTimer = f.timers.get(capture.timer);
 assert.equal(f.get('#capture-button').disabled, true);
 await f.api.interruptCamera('Presage processing stopped.');
 assert.equal(f.api.s.capture, null);
 assert.equal(f.get('#modal').open, false);
 assert.equal(f.api.s.mode, 'idle');
 assert.equal(f.api.s.banner, 'Presage processing stopped.');
 assert.equal(camera.track.readyState, 'ended');
 assert.equal(source.stops, 1);
 assert.equal(f.timers.has(capture.timer), false);
 staleTimer();
 assert.equal(f.get('#modal').open, false);
 assert.equal(f.api.s.calStep, 0);
});

test('a capture completes on its deadline even if animation frames stop', async () => {
 const f = fixture(); f.live();
 await f.api.action('capture', f.get('#capture-button'));
 const capture = f.api.s.capture;
 capture.features = Array.from({ length: 25 }, () => [.2,.2,.3]);
 f.advance(3200);
 f.runTimer(capture.timer);
 assert.equal(f.api.s.calStep, 1);
 assert.equal(f.api.s.capture, null);
 assert.equal(f.get('#capture-button').disabled, false);
 assert.equal(f.get('#modal').open, true);
});

test('missing samples restore the capture button without advancing calibration', async () => {
 const f = fixture(); f.live();
 await f.api.action('capture', f.get('#capture-button'));
 const timer = f.api.s.capture.timer;
 f.api.s.gate.fresh = () => false;
 f.advance(3200); f.runTimer(timer);
 assert.equal(f.api.s.calStep, 0);
 assert.equal(f.api.s.capture, null);
 assert.equal(f.get('#capture-button').disabled, false);
 assert.match(f.get('#modal').innerHTML, /Live tracking is unavailable/);
});

test('capture waits for fresh landmarks rather than disabling itself during startup', async () => {
 const f = fixture(); f.live();
 f.api.s.gate.fresh = () => false;
 f.api.s.hint = 'Presage is starting.';
 await f.api.action('capture', f.get('#capture-button'));
 assert.equal(f.api.s.capture, null);
 assert.equal(f.get('#capture-button').disabled, false);
 assert.equal(f.get('#cal-status').textContent, 'Presage is starting.');
});

test('a late ended event from an old stream cannot stop a replacement camera', () => {
 const f = fixture(), { camera, source } = f.live();
 f.api.attach();
 const oldEnded = camera.track.onended, replacement = stream();
 f.api.s.stream = replacement;
 oldEnded();
 assert.equal(f.api.s.stream, replacement);
 assert.equal(replacement.track.stops, 0);
 assert.equal(source.stops, 0);
});

test('an ended camera cancels raised-pose capture and closes its stale dialog', async () => {
 const f = fixture(), { camera } = f.live();
 f.api.s.calStep = 1; f.api.calibration(); f.api.attach();
 await f.api.action('capture', f.get('#capture-button'));
 camera.track.readyState = 'ended'; camera.track.onended();
 assert.equal(f.api.s.capture, null);
 assert.equal(f.get('#modal').open, false);
 assert.equal(f.api.s.mode, 'idle');
});

test('reconnecting waits for a detached previous SDK shutdown', async () => {
 const f = fixture(); f.live();
 let release;
 f.api.s.source.stop = () => new Promise(resolve => { release = resolve; });
 const stopping = f.api.stopCamera(false);
 const reconnecting = f.api.startCamera(true);
 await Promise.resolve(); await Promise.resolve();
 assert.equal(f.sources.length, 0);
 release();
 await stopping; await reconnecting;
 assert.equal(f.sources.length, 1);
 assert.equal(f.api.s.mode, 'live');
 assert.equal(f.api.s.calStep, 0);
 assert.equal(f.get('#modal').open, true);
});

test('hiding the page cancels capture and leaves no disabled calibration dialog', async () => {
 const f = fixture(), { camera } = f.live();
 await f.api.action('capture', f.get('#capture-button'));
 f.api.s.calStep = 1;
 f.api.s.calSamples.neutral = Array.from({ length: 20 }, () => [.2,.2,.3]);
 // The actual registered visibility handler is exercised here.
 f.api.s.clock.running = false;
 f.listeners.get('visibilitychange').call(null);
 assert.equal(camera.track.readyState, 'live');
 // Visible-page events must not stop capture. A hidden-page event does.
 f.document.hidden = true;
 f.listeners.get('visibilitychange')();
 assert.equal(camera.track.readyState, 'ended');
 assert.equal(f.api.s.capture, null);
 assert.equal(f.api.s.cal, null);
 assert.equal(f.get('#modal').open, false);
 assert.equal(f.timers.size, 0);
});

test('the actual SDK error callback recovers a raised-pose capture', async () => {
 const f = fixture();
 await f.api.startCamera(true);
 f.api.s.gate.fresh = () => true;
 f.api.s.calStep = 1; f.api.calibration();
 await f.api.action('capture', f.get('#capture-button'));
 f.sources[0].callbacks.onError('SmartSpectra session ended.', { code: 1 });
 assert.equal(f.api.s.capture, null);
 assert.equal(f.get('#modal').open, false);
 assert.equal(f.api.s.mode, 'idle');
 assert.equal(f.api.s.banner, 'SmartSpectra session ended.');
 assert.equal(f.sources[0].stops, 1);
});

test('hiding during a reconnect cancels the disabled consent dialog before starting another camera', async () => {
 const f = fixture(); f.live();
 let release;
 f.api.s.source.stop = () => new Promise(resolve => { release = resolve; });
 const stopping = f.api.stopCamera(false);
 f.api.consent(true);
 const reconnecting = f.api.startCamera(true);
 await Promise.resolve(); await Promise.resolve();
 f.document.hidden = true;
 f.listeners.get('visibilitychange')();
 assert.equal(f.get('#modal').open, false);
 release(); await stopping; await reconnecting;
 assert.equal(f.sources.length, 0);
 assert.equal(f.api.s.stream, null);
});

test('a rejected cancelled startup cannot stop a newer live connection', async () => {
 const f = fixture();
 let rejectFirst, calls = 0;
 f.Source.prototype.start = function () {
  this.callbacks.onStream(this.stream);
  calls++;
  return calls === 1 ? new Promise((_resolve, reject) => { rejectFirst = reject; }) : Promise.resolve();
 };
 f.api.consent(true);
 const first = f.api.startCamera(true);
 while (f.sources.length === 0) await Promise.resolve();
 await f.api.action('close-modal', f.get('#modal'));
 f.api.consent(true);
 await f.api.startCamera(true);
 const current = f.api.s.source;
 rejectFirst(Error('Cancelled startup'));
 await first;
 assert.equal(f.api.s.source, current);
 assert.equal(f.api.s.mode, 'live');
 assert.equal(current.stops, 0);
 assert.equal(f.api.modalPurpose(), 'calibration');
});

test('a late successful cancelled startup cannot stop a newer live connection', async () => {
 const f = fixture();
 let resolveFirst, calls = 0;
 f.Source.prototype.start = function () {
  this.callbacks.onStream(this.stream);
  calls++;
  return calls === 1 ? new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve();
 };
 f.api.consent(true);
 const first = f.api.startCamera(true);
 while (f.sources.length === 0) await Promise.resolve();
 await f.api.action('close-modal', f.get('#modal'));
 f.api.consent(true);
 await f.api.startCamera(true);
 const current = f.api.s.source;
 resolveFirst();
 await first;
 assert.equal(f.api.s.source, current);
 assert.equal(current.stops, 0);
 assert.equal(f.api.s.mode, 'live');
});

test('a cancelled mirror permission request cannot overwrite a newer camera stream', async () => {
 const f = fixture();
 let resolveFirst, calls = 0;
 const oldStream = stream(), nextStream = stream();
 f.navigator.mediaDevices.getUserMedia = () => ++calls === 1 ?
  new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve(nextStream);
 f.api.consent(false);
 const first = f.api.startCamera(false);
 while (calls === 0) await Promise.resolve();
 await f.api.action('close-modal', f.get('#modal'));
 f.api.consent(false);
 await f.api.startCamera(false);
 resolveFirst(oldStream); await first;
 assert.equal(f.api.s.stream, nextStream);
 assert.equal(nextStream.track.stops, 0);
 assert.equal(oldStream.track.readyState, 'ended');
});

test('a native low-frame-rate warning blocks capture without disabling the button', async () => {
 const f = fixture(); f.live();
 f.api.s.validationCode = 11;
 f.api.s.hint = 'Camera frame rate is too low.';
 await f.api.action('capture', f.get('#capture-button'));
 assert.equal(f.api.s.capture, null);
 assert.equal(f.get('#capture-button').disabled, false);
 assert.equal(f.get('#cal-status').textContent, 'Camera frame rate is too low.');
});

test('a low-frame-rate warning cancels a capture without accepting its stored samples', async () => {
 const f = fixture(); f.live();
 await f.api.action('capture', f.get('#capture-button'));
 const capture = f.api.s.capture;
 capture.features = Array.from({length:25}, () => [.2,.2,.3]);
 f.api.s.validationCode = 11;
 f.api.s.hint = 'Camera frame rate is too low.';
 f.runTimer(capture.timer);
 assert.equal(f.api.s.capture, null);
 assert.equal(f.api.s.calStep, 0);
 assert.equal(f.api.s.calSamples.neutral.length, 0);
 assert.equal(f.get('#capture-button').disabled, false);
 assert.match(f.get('#modal').innerHTML, /Camera frame rate is too low/);
});

test('a fatal frame-rate error offers practical recovery and does not reconnect automatically', async () => {
 const f = fixture(); await f.api.startCamera(true);
 f.sources[0].callbacks.onError('SmartSpectra stopped because the frame rate stayed too low.', {code:14,retryable:true});
 assert.equal(f.api.s.mode, 'idle');
 assert.match(f.api.s.banner, /Close unused apps or video tabs/);
 assert.equal(f.sources.length, 1);
 assert.equal(f.get('#modal').open, false);
});

test('repeated landmark packets reuse the overlay canvas instead of reallocating it', () => {
 const f = fixture(); f.live();
 const canvas = f.get('#camera-overlay'), video = f.get('#camera-video');
 let width = 0, height = 0, widthWrites = 0, heightWrites = 0;
 Object.defineProperties(canvas, {
  width: { get: () => width, set: value => { width = value; widthWrites++; } },
  height: { get: () => height, set: value => { height = value; heightWrites++; } }
 });
 video.videoWidth = 640; video.videoHeight = 480;
 canvas.getContext = () => ({ clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} });
 f.api.s.gate.ingest = () => ({valid:true,features:[.2,.2,.3],points:Array.from({length:478},()=>({x:100,y:100}))});
 f.api.handleSample({});
 f.api.handleSample({});
 assert.equal(widthWrites, 1);
 assert.equal(heightWrites, 1);
});


test('native calibration keeps one camera across all three poses without a browser stream', async () => {
 const f = fixture();
 f.Source.prototype.start = async function () { this.callbacks.onCameraActive(true); };
 f.navigator.mediaDevices = undefined;
 await f.api.startCamera(true);
 assert.equal(f.api.s.stream,null);
 assert.equal(f.api.s.nativeCamera,true);
 assert.equal(f.sources.length,1);
 f.api.s.gate.fresh = () => true;
 const features = [[.2,.2,.3],[.3,.3,.3],[.12,.12,.2]];
 for (let step=0;step<3;step++) {
  await f.api.action('capture',f.get('#capture-button'));
  assert.ok(f.api.s.capture);
  f.api.s.capture.features=Array.from({length:25},()=>features[step]);
  f.advance(3200);f.runTimer(f.api.s.capture.timer);
  assert.equal(f.api.s.nativeCamera,true);
  assert.equal(f.sources[0].stops,0);
 }
 assert.equal(f.api.s.cal.ok,true);
 assert.equal(f.get('#modal').open,false);
 await f.api.action('camera',f.get('#camera-zone'));
 assert.equal(f.api.s.nativeCamera,false);
 assert.equal(f.sources[0].stops,1);
});

test('native errors cancel an unfinished raised capture without a MediaStream', async () => {
 const f = fixture();
 f.Source.prototype.start = async function () { this.callbacks.onCameraActive(true); };
 await f.api.startCamera(true);
 f.api.s.gate.fresh = () => true;
 f.api.s.calStep=1;f.api.calibration();
 await f.api.action('capture',f.get('#capture-button'));
 f.sources[0].callbacks.onError('Native capture stopped.',{code:14});
 assert.equal(f.api.s.nativeCamera,false);
 assert.equal(f.api.s.capture,null);
 assert.equal(f.get('#modal').open,false);
 assert.equal(f.sources[0].stops,1);
});
