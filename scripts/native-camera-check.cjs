'use strict';
const readline = require('node:readline');
const { Writable } = require('node:stream');

function safeText(value, key) {
 return String(value || 'Unknown SDK error').split(key).join('[hidden]');
}
async function runNativeCheck({ key, runtime, durationMs = 20000, log = console.log, signal } = {}) {
 if (!key?.trim()) throw Error('A Presage API key is required.');
 key = key.trim();
 runtime ||= { ...require('@smartspectra/node-sdk'), decodeMetrics: require('@smartspectra/node-sdk/messages').decodeMetrics };
 const { SmartSpectraSDK, MetricType, CameraSelection, decodeMetrics } = runtime;
 let sdk, finish, error = null, packets = 0, stablePackets = 0, frameCallbacks = 0;
 let lastSeen = 0, lastAgeMs = null, lastValidation, lastState, timer, progress;
 const started = Date.now(), done = new Promise(resolve => { finish = resolve; });
 const aborted = () => finish('cancelled');
 signal?.addEventListener('abort', aborted, { once: true });
 const summary = () => log(`Landmark packets: ${packets}; stable packets: ${stablePackets}`);
 try {
  sdk = new SmartSpectraSDK({
   apiKey: key,
   requestedMetrics: [MetricType.FACE_LANDMARKS],
   enableTelemetry: false,
   enableAccumulatedOutput: false
  });
  sdk.on('processingStatus', state => {
   if (state !== lastState) {
    lastState = state;
    log('SDK state: ' + ({0:'uninitialized',1:'idle',2:'starting',3:'running',4:'stopping',5:'error'}[state] || state));
   }
  });
  sdk.on('validationStatus', (code, _timestamp, hint) => {
   if (code !== lastValidation) {
    lastValidation = code;
    log('Camera guidance: ' + (hint ? safeText(hint, key) : 'ready'));
   }
  });
  sdk.on('metrics', buffer => {
   const data = decodeMetrics(buffer);
   for (const frame of data?.face?.landmarks || []) {
    packets++;
    if (frame.stable === true && !frame.reset && Array.isArray(frame.value) && frame.value.length === 478) {
     stablePackets++;
     lastSeen = Date.now();
     const timestamp = Number(frame.timestamp);
     if (Number.isFinite(timestamp) && timestamp > 0) lastAgeMs = Math.round(Date.now() - timestamp / 1000);
    }
   }
  });
  sdk.on('frameSentThrough', sent => { if (sent) frameCallbacks++; });
  sdk.on('error', (code, message, retryable) => {
   error = { code, message: safeText(message, key), retryable: Boolean(retryable) };
   log(`SDK error ${code}: ${error.message}`);
   finish('sdk_error');
  });
  sdk.useCamera(CameraSelection.default, { width: 640, height: 480, fps: 30 });
  log('Direct SDK camera check: 640×480 requested at 30 fps.');
  log('Keep your face visible and use steady front lighting.');
  timer = setTimeout(() => finish('completed'), durationMs);
  progress = setInterval(summary, 2000);
  if (signal?.aborted) finish('cancelled');
  else sdk.start();
  const reason = await done;
  const liveObserved = reason === 'completed' && !error && lastState === 3 && lastValidation !== 11 && stablePackets >= 20 && lastSeen > 0 && Date.now() - lastSeen < 2000;
  summary();
  if (lastAgeMs !== null) log('Last landmark timestamp age: ' + lastAgeMs + ' ms.');
  log(liveObserved ? 'RESULT: LIVE LANDMARKS RECEIVED' : 'RESULT: LIVE CAPTURE NOT VERIFIED');
  return { reason, liveObserved, landmarkPackets: packets, stablePackets, frameCallbacks, lastSampleAgeMs: lastAgeMs, elapsedMs: Date.now() - started, error };
 } catch (failure) {
  error = { code: failure.code ?? null, message: safeText(failure.message, key), retryable: Boolean(failure.retryable) };
  log('Camera check failed: ' + error.message);
  return { reason: 'exception', liveObserved: false, landmarkPackets: packets, stablePackets, frameCallbacks, lastSampleAgeMs: lastAgeMs, elapsedMs: Date.now() - started, error };
 } finally {
  clearTimeout(timer);
  clearInterval(progress);
  signal?.removeEventListener('abort', aborted);
  if (sdk) {
   try { await sdk.stopAsync(); }
   catch (failure) { log('Shutdown note: ' + safeText(failure.message, key)); }
   finally { try { await sdk.destroy(); } catch (failure) { log('Shutdown note: ' + safeText(failure.message,key)); } }
  }
 }
}

function readSecret(input = process.stdin, output = process.stdout) {
 if (!input.isTTY) return Promise.reject(Error('Run this check in an interactive terminal.'));
 return new Promise((resolve, reject) => {
  // Readline edits the real value in memory; its own output is suppressed.
  // Only this masked representation reaches the terminal.
  const sink = new Writable({ write(_chunk, _encoding, next) { next(); } });
  const rl = readline.createInterface({ input, output: sink, terminal: true, historySize: 0 });
  let settled = false;
  const redraw = () => {
   if (settled) return;
   readline.clearLine(output, 0);
   readline.cursorTo(output, 0);
   output.write('Presage API key: ' + '*'.repeat(Math.min(rl.line.length, 48)) + ' [' + rl.line.length + ' characters]');
  };
  const removeMaskListener = () => input.removeListener('keypress', redraw);
  input.on('keypress', redraw);
  rl.once('close', () => {
   removeMaskListener();
   if (!settled) {
    settled = true;
    output.write('\n');
    reject(Error('Camera check cancelled.'));
   }
  });
  rl.on('SIGINT', () => {
   if (settled) return;
   settled = true;
   rl.close(); output.write('\n');
   reject(Error('Camera check cancelled.'));
  });
  output.write('Paste once. Ctrl+U clears the entry. Enter starts the camera.\n');
  redraw();
  rl.question('', value => {
   if (settled) return;
   settled = true;
   removeMaskListener();
   rl.close();
   output.write('\nInput received (' + value.trim().length + ' characters).\n');
   resolve(value.trim());
  });
 });
}

async function main() {
 const runtime = require('@smartspectra/node-sdk');
 if (process.argv.includes('--list')) {
  const cameras = runtime.SmartSpectraSDK.availableCameras();
  console.log('SDK ' + runtime.SmartSpectraSDK.version + '; cameras: ' + cameras.map(camera => camera.name).join(', '));
  return;
 }
 console.log('This uses your camera for 20 seconds after you enter the key.');
 console.log('No video is recorded. Only counts and status messages are printed; SDK telemetry is disabled.');
 const key = await readSecret();
 const controller = new AbortController();
 const cancel = () => controller.abort();
 process.once('SIGINT', cancel);
 try {
  const result = await runNativeCheck({ key, runtime: { ...runtime, decodeMetrics: require('@smartspectra/node-sdk/messages').decodeMetrics }, signal: controller.signal });
  process.exitCode = result.liveObserved ? 0 : 1;
 } finally { process.removeListener('SIGINT', cancel); }
}
module.exports = { runNativeCheck, safeText, readSecret };
if (require.main === module) main().catch(error => {
 console.error(error.message);
 process.exitCode = 1;
});
