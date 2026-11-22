import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runNativeCheck, safeText, readSecret } = require('../scripts/native-camera-check.cjs');

function fixture({ fail = false, stale = false, tooSlow = false, throws = false } = {}) {
 const calls = [], logs = [];
 class SDK {
  constructor(options) { this.options = options; this.handlers = new Map(); calls.push(['create', options]); }
  on(name, fn) { this.handlers.set(name, fn); }
  useCamera(selection, options) { calls.push(['camera', selection, options]); }
  start() {
   calls.push(['start']);
   if (throws) throw Object.assign(Error('Cannot use secret-test-key'), { code: 2 });
   this.handlers.get('processingStatus')(3);
   if (tooSlow) this.handlers.get('validationStatus')(11, 0, 'Frame rate too low.');
   if (fail) { this.handlers.get('error')(14, 'Frame rate too low: secret-test-key', true); return; }
   this.handlers.get('metrics')({ face: { landmarks: Array.from({length:25}, () => ({
    stable:true, value:Array.from({length:478},()=>({x:1,y:1})),
    timestamp: Date.now()*1000
   })) } });
   if (stale) this.handlers.get('processingStatus')(1);
  }
  async stopAsync() { calls.push(['stop']); }
  async destroy() { calls.push(['destroy']); }
 }
 const runtime = { SmartSpectraSDK: SDK, MetricType: {FACE_LANDMARKS:11}, CameraSelection: {default:{kind:'default'}}, decodeMetrics: x => x };
 const run = () => runNativeCheck({key:'secret-test-key',runtime,durationMs:2,log:text=>logs.push(text)});
 return {calls,logs,run};
}
test('direct check uses native camera capture and requests landmarks only', async () => {
 const f = fixture(), result = await f.run();
 assert.equal(result.liveObserved, true);
 assert.equal(result.stablePackets, 25);
 assert.deepEqual(f.calls.find(x=>x[0]==='camera'), ['camera',{kind:'default'},{width:640,height:480,fps:30}]);
 const options = f.calls[0][1];
 assert.deepEqual(options.requestedMetrics,[11]);
 assert.equal(options.enableTelemetry,false);
 assert.equal(options.enableAccumulatedOutput,false);
 assert.deepEqual(f.calls.slice(-2),[['stop'],['destroy']]);
});
test('a native low-frame-rate stop remains a failure and is not retried', async () => {
 const f = fixture({fail:true}), result = await f.run();
 assert.equal(result.liveObserved,false);
 assert.equal(result.error.code,14);
 assert.equal(f.calls.filter(x=>x[0]==='start').length,1);
 assert.equal(JSON.stringify(result).includes('secret-test-key'),false);
 assert.equal(f.logs.join('\n').includes('secret-test-key'),false);
 assert.deepEqual(f.calls.slice(-2),[['stop'],['destroy']]);
});
test('a stopped session is not reported as verified live capture', async () => {
 const f = fixture({stale:true});
 assert.equal((await f.run()).liveObserved,false);
});
test('a frame-rate validation warning prevents a successful check result', async () => {
 const f = fixture({tooSlow:true});
 assert.equal((await f.run()).liveObserved,false);
});
test('startup failures are redacted and still destroy the native session', async () => {
 const f = fixture({throws:true}), result = await f.run();
 assert.equal(result.liveObserved,false);
 assert.equal(result.error.code,2);
 assert.equal(result.error.message.includes('secret-test-key'),false);
 assert.deepEqual(f.calls.slice(-2),[['stop'],['destroy']]);
});
test('empty keys and non-interactive key prompts fail without starting capture', async () => {
 await assert.rejects(runNativeCheck({key:' '}),/key is required/);
 await assert.rejects(readSecret({isTTY:false}),/interactive terminal/);
 assert.equal(safeText('key: abc123','abc123'),'key: [hidden]');
});

test('key entry displays masked feedback without exposing pasted credentials', async () => {
 const { PassThrough } = await import('node:stream');
 const input = new PassThrough();
 input.isTTY = true; input.setRawMode = () => input;
 let display = '';
 const output = { write(chunk) { display += String(chunk); return true; } };
 const pending = readSecret(input, output);
 input.write('private-paste-key');
 input.write('\r');
 assert.equal(await pending, 'private-paste-key');
 assert.ok(display.includes('*'));
 assert.ok(display.includes('16 characters'));
 assert.equal(display.includes('private-paste-key'), false);
 assert.equal(input.listenerCount('keypress'), 0);
 input.destroy();
});

test('Ctrl+U clears repeated pastes before accepting a clean key', async () => {
 const { PassThrough } = await import('node:stream');
 const input = new PassThrough();
 input.isTTY = true; input.setRawMode = () => input;
 let display = '';
 const output = { write(chunk) { display += String(chunk); return true; } };
 const pending = readSecret(input, output);
 input.write('old-keyold-key');
 input.write('\x15');
 input.write('fresh-private-key');
 input.write('\r');
 assert.equal(await pending, 'fresh-private-key');
 assert.equal(display.includes('old-key'), false);
 assert.equal(display.includes('fresh-private-key'), false);
 input.destroy();
});
