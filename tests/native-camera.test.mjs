import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { NativePresageSource } from '../web/adapters/native-presage.js';
const require = createRequire(import.meta.url);
const { NativeCameraHost, bindNativeCameraIpc } = require('../desktop/native-camera.cjs');

function fixture({ stop, destroy, loadRuntime } = {}) {
 const instances = [], events = [], sent = [];
 class SDK {
  constructor(options) { this.options = options; this.callbacks = new Map(); instances.push(this); events.push('construct'); }
  on(name, callback) { this.callbacks.set(name, callback); }
  emit(name, ...values) { this.callbacks.get(name)?.(...values); }
  useCamera(selection, options) { this.camera = { selection, options }; events.push('camera'); }
  start() { events.push('start'); this.emit('processingStatus', 2); }
  stopAsync() { events.push('stop'); return stop?.() || Promise.resolve(); }
  destroy() { events.push('destroy'); return destroy?.() || Promise.resolve(); }
 }
 const runtime = { SmartSpectraSDK: SDK, CameraSelection: { default: { kind: 'default' } }, MetricType: { FACE_LANDMARKS: 11 }, decodeMetrics: value => value };
 const host = new NativeCameraHost({ loadRuntime: loadRuntime || (() => runtime), emit: event => sent.push(event) });
 return { host, runtime, instances, events, sent };
}
const request = id => ({ id, key: 'private-test-key' });

test('native capture requests the verified camera path and forwards decoded pixel landmarks only', async () => {
 const f = fixture();
 const result = await f.host.start(request('one'));
 const sdk = f.instances[0];
 assert.deepEqual(sdk.camera, { selection: { kind: 'default' }, options: { width: 640, height: 480, fps: 30 } });
 assert.deepEqual(sdk.options, { apiKey: 'private-test-key', requestedMetrics: [11], enableTelemetry: false, enableAccumulatedOutput: false });
 assert.equal(result.camera.requested, true);
 assert.equal(sdk.callbacks.has('videoOutput'), false);
 const frame = { timestamp: { valueOf: () => 123000 }, stable: true, value: Array.from({length:478}, () => ({x:10,y:20,z:3})) };
 sdk.emit('metrics', { face: { landmarks: [frame] }, otherMetrics: ['not-forwarded'] });
 const received = f.sent.at(-1);
 assert.equal(received.id, 'one');
 assert.equal(received.frame.timestamp, 123000);
 assert.deepEqual(received.frame.value[0], {x:10,y:20});
 assert.equal(JSON.stringify(f.sent).includes('private-test-key'), false);
 await f.host.stop('one');
});

test('native errors redact the key and preserve the error code', async () => {
 const f = fixture(); await f.host.start(request('one'));
 f.instances[0].emit('error', 2, 'Rejected private-test-key', false);
 assert.deepEqual(f.sent.at(-1), {id:'one',kind:'error',code:2,message:'Rejected [hidden]',retryable:false});
 await f.host.stop('one');
});

test('native reconnect waits for stop and destroy and disarms retired callbacks immediately', async () => {
 let release;
 const f = fixture({ stop: () => new Promise(resolve => { release = resolve; }) });
 await f.host.start(request('one'));
 const old = f.instances[0], count = f.sent.length;
 const stopping = f.host.stop('one');
 const starting = f.host.start(request('two'));
 old.emit('error', 14, 'late error', true);
 await Promise.resolve(); await Promise.resolve();
 assert.equal(f.sent.length, count);
 assert.equal(f.instances.length, 1);
 release();
 await stopping; await starting;
 assert.equal(f.instances.length, 2);
 assert.ok(f.events.indexOf('destroy') < f.events.lastIndexOf('construct'));
 const finalStop = f.host.stop('two');
 await Promise.resolve(); await Promise.resolve();
 release(); await finalStop;
});

test('stale stop requests cannot close a replacement native camera', async () => {
 const f = fixture();
 await f.host.start(request('one')); await f.host.start(request('two'));
 await f.host.stop('one');
 assert.equal(f.host.session.id, 'two');
 assert.equal(f.events.filter(x => x === 'stop').length, 1);
 await f.host.stop('two');
});

test('cancelling a delayed native runtime load never opens a camera', async () => {
 let release;
 const f = fixture({ loadRuntime: () => new Promise(resolve => { release = resolve; }) });
 const starting = f.host.start(request('one'));
 while (!release) await Promise.resolve();
 const stopping = f.host.stop('one');
 release(f.runtime);
 assert.equal((await starting).cancelled, true);
 await stopping;
 assert.equal(f.instances.length, 0);
});

test('a failed native stop still destroys its session before a replacement starts', async () => {
 const f = fixture({ stop: () => Promise.reject(Error('stop failed')) });
 await f.host.start(request('one'));
 await f.host.start(request('two'));
 assert.deepEqual(f.events.slice(0,6), ['construct','camera','start','stop','destroy','construct']);
 await f.host.stop('two');
});

test('failed native destruction blocks replacement until cleanup succeeds', async () => {
 let shouldFail = true;
 const f = fixture({ destroy: () => shouldFail ? Promise.reject(Error('destroy failed')) : Promise.resolve() });
 await f.host.start(request('one'));
 await assert.rejects(f.host.start(request('two')), /destroy failed/);
 assert.equal(f.instances.length, 1);
 shouldFail = false;
 await f.host.start(request('three'));
 assert.equal(f.instances.length, 2);
 await f.host.stop('three');
});

test('invalid native session requests never construct the SDK', async () => {
 const f = fixture();
 await assert.rejects(f.host.start({id:'../bad',key:'test'}), /session/);
 await assert.rejects(f.host.start({id:'one',key:''}), /API key/);
 await assert.rejects(f.host.start({id:'one',key:'x'.repeat(1025)}), /API key/);
 assert.equal(f.instances.length, 0);
});

test('only the local main frame can start or stop the desktop camera', async () => {
 const handlers = new Map(), window = new EventEmitter(), wc = new EventEmitter();
 window.webContents = wc;
 wc.mainFrame = {url:'file:///inflect/index.html'};
 wc.isDestroyed = () => false; wc.send = () => {};
 const ipcMain = {handle:(name,fn)=>handlers.set(name,fn),removeHandler:name=>handlers.delete(name)};
 const f = fixture();
 const host = bindNativeCameraIpc(window, {ipcMain,own:url=>url==='file:///inflect/index.html',loadRuntime:()=>f.runtime});
 const start = handlers.get('inflect:camera:start'), stop = handlers.get('inflect:camera:stop');
 const trusted = {sender:wc,senderFrame:wc.mainFrame};
 await assert.rejects(start({sender:wc,senderFrame:{url:wc.mainFrame.url}},request('one')), /unavailable/);
 await assert.rejects(start({sender:{},senderFrame:wc.mainFrame},request('one')), /unavailable/);
 await start(trusted,request('one'));
 wc.mainFrame.url = 'https://example.com';
 await assert.rejects(stop(trusted,'one'), /unavailable/);
 wc.emit('did-start-navigation',{},'https://example.com',false,true);
 await host.tail;
 assert.equal(host.session,null);
 window.emit('closed');
 assert.equal(handlers.size,0);
});

function bridgeFixture() {
 const listeners = new Set(), requests = [], stops = [], active = [], samples = [], errors = [], settings = [];
 let counter = 0;
 const bridge = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async start(value) { requests.push(value); return {camera:{width:640,height:480,frameRate:30,requested:true}}; },
  async stop(id) { stops.push(id); }
 };
 const source = new NativePresageSource({
  onCameraActive:value=>active.push(value), onSample:value=>samples.push(value),
  onCameraSettings:value=>settings.push(value), onError:(message,details)=>errors.push({message,details})
 },{bridge,makeId:()=> 'native-' + ++counter});
 return {source,bridge,requests,stops,active,samples,errors,settings,listeners,
  emit(event) { for (const listener of listeners) listener(event); }};
}

test('native renderer adapter receives landmarks without requesting a second camera stream', async () => {
 const f = bridgeFixture();
 await f.source.start(' test-key ');
 assert.equal(f.requests[0].key,'test-key');
 assert.equal(f.active.at(-1),true);
 assert.equal(f.settings[0].requested,true);
 f.emit({kind:'sample',id:'retired',frame:{timestamp:1}});
 assert.equal(f.samples.length,0);
 f.emit({kind:'sample',id:'native-1',frame:{timestamp:2}});
 assert.equal(f.samples.length,1);
 await f.source.stop();
 assert.equal(f.active.at(-1),false);
 assert.equal(f.listeners.size,0);
 assert.deepEqual(f.stops,['native-1']);
});

test('native renderer failures keep one useful error and remove the subscription on stop', async () => {
 const f = bridgeFixture(); await f.source.start('private-key');
 f.emit({kind:'processingStatus',id:'native-1',status:3});
 f.emit({kind:'error',id:'native-1',code:14,message:'Frame rate failed private-key',retryable:true});
 f.emit({kind:'processingStatus',id:'native-1',status:1});
 f.emit({kind:'sample',id:'native-1',frame:{}});
 assert.equal(f.errors.length,1);
 assert.equal(f.samples.length,0);
 assert.equal(f.errors[0].message,'Frame rate failed [hidden]');
 assert.equal(f.errors[0].details.code,14);
 await f.source.stop();
 assert.equal(f.listeners.size,0);
});

test('a cancelled native adapter startup cannot reopen capture after pending cleanup', async () => {
 const f = bridgeFixture(); await f.source.start('key');
 let release;
 f.bridge.stop = () => new Promise(resolve => {release=resolve;});
 const next = f.source.start('key');
 const cancelled = f.source.stop();
 release(); await next; await cancelled;
 assert.equal(f.requests.length,1);
 assert.equal(f.listeners.size,0);
});

test('an error returned by the native bridge closes its session and preserves the explanation', async () => {
 const f = bridgeFixture();
 f.bridge.start = async () => ({error:{code:2,message:'Authentication failed.',retryable:false}});
 await assert.rejects(f.source.start('key'), /Authentication failed/);
 assert.equal(f.listeners.size,0);
 assert.deepEqual(f.stops,['native-1']);
 assert.equal(f.active.at(-1),false);
});


test('a terminal native error state recovers even if no detailed error arrives', async () => {
 const f=bridgeFixture();await f.source.start('key');
 f.emit({kind:'processingStatus',id:'native-1',status:5});
 await new Promise(resolve=>setTimeout(resolve,130));
 assert.equal(f.errors.length,1);assert.equal(f.errors[0].details.status,5);
 await f.source.stop();
});

test('a detailed native error wins over its deferred terminal-state fallback', async () => {
 const f=bridgeFixture();await f.source.start('key');
 f.emit({kind:'processingStatus',id:'native-1',status:5});
 f.emit({kind:'error',id:'native-1',code:2,message:'Authentication failed.',retryable:false});
 await new Promise(resolve=>setTimeout(resolve,130));
 assert.equal(f.errors.length,1);assert.equal(f.errors[0].details.code,2);
 await f.source.stop();
});
