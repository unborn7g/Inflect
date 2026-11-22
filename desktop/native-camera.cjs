'use strict';

// Capture stays inside the native SDK. Only landmarks and guidance cross IPC.
class NativeCameraHost {
 constructor({ loadRuntime = () => ({
  ...require('@smartspectra/node-sdk'),
  decodeMetrics: require('@smartspectra/node-sdk/messages').decodeMetrics
 }), emit = () => {} } = {}) {
  this.loadRuntime = loadRuntime;
  this.emit = emit;
  this.session = null;
  this.requestedId = null;
  this.revision = 0;
  this.tail = Promise.resolve();
 }
 enqueue(work) {
  const result = this.tail.then(work);
  this.tail = result.catch(() => {});
  return result;
 }
 async retire() {
  const session = this.session;
  if (!session) return;
  session.active = false;
  try { await session.sdk.stopAsync(); } catch { /* destroy still must run */ }
  try { await session.sdk.destroy(); }
  catch (error) { throw Error(String(error.message || 'Camera cleanup could not complete.').split(session.key).join('[hidden]')); }
  session.key = '';
  if (this.session === session) this.session = null;
 }
 start(request) {
  const id = request?.id, key = request?.key;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return Promise.reject(Error('Invalid camera session.'));
  if (typeof key !== 'string' || !key.trim() || key.length > 1024) return Promise.reject(Error('Enter your Presage API key.'));
  const secret = key.trim(), revision = ++this.revision;
  this.requestedId = id;
  if (this.session) this.session.active = false;
  return this.enqueue(async () => {
   await this.retire();
   if (revision !== this.revision) return { cancelled: true };
   const runtime = await this.loadRuntime();
   if (revision !== this.revision) return { cancelled: true };
   const { SmartSpectraSDK, CameraSelection, MetricType, decodeMetrics } = runtime;
   let session;
   try {
    const sdk = new SmartSpectraSDK({
     apiKey: secret, requestedMetrics: [MetricType.FACE_LANDMARKS],
     enableTelemetry: false, enableAccumulatedOutput: false
    });
    session = this.session = { id, sdk, key: secret, active: true };
    const current = () => this.session === session && session.active && revision === this.revision;
    const send = event => { if (current()) this.emit({ ...event, id }); };
    const redact = message => String(message || 'Presage could not continue.').split(secret).join('[hidden]').slice(0, 2048);
    sdk.on('processingStatus', status => send({ kind: 'processingStatus', status }));
    sdk.on('validationStatus', (code, _timestamp, hint) => send({ kind: 'validationStatus', code, hint: hint ? redact(hint) : '' }));
    sdk.on('error', (code, message, retryable) => send({ kind: 'error', code, message: redact(message), retryable: Boolean(retryable) }));
    sdk.on('metrics', buffer => {
     if (!current()) return;
     try {
      for (const frame of decodeMetrics(buffer)?.face?.landmarks || []) {
       if (frame.reset) {
        send({ kind: 'sample', frame: { timestamp: Number(frame.timestamp), stable: false, reset: true, value: [] } });
       } else if (Array.isArray(frame.value) && frame.value.length === 478) {
        send({ kind: 'sample', frame: {
         timestamp: Number(frame.timestamp), stable: frame.stable === true, reset: false,
         value: frame.value.map(point => ({ x: point.x, y: point.y }))
        } });
       }
      }
     } catch { send({ kind: 'validationStatus', hint: 'Measurement unavailable.' }); }
    });
    sdk.useCamera(CameraSelection.default, { width: 640, height: 480, fps: 30 });
    sdk.start();
    return { camera: { width: 640, height: 480, frameRate: 30, requested: true } };
   } catch (error) {
    const failure = Object.assign(Error(String(error.message || 'Camera could not start.').split(secret).join('[hidden]')), {
     code: error.code, retryable: Boolean(error.retryable)
    });
    if (this.session === session) await this.retire();
    throw failure;
   }
  });
 }
 stop(id) {
  // A delayed stop from an old renderer must not stop its replacement.
  if (id !== undefined && id !== this.requestedId) return Promise.resolve();
  this.revision++;
  this.requestedId = null;
  if (this.session) this.session.active = false;
  return this.enqueue(() => this.retire());
 }
}

function bindNativeCameraIpc(window, { ipcMain, own, loadRuntime } = {}) {
 const wc = window.webContents;
 const trusted = event => event.sender === wc && event.senderFrame === wc.mainFrame && own(event.senderFrame.url);
 const host = new NativeCameraHost({
  loadRuntime,
  emit: event => { if (!wc.isDestroyed()) wc.send('inflect:camera:event', event); }
 });
 ipcMain.handle('inflect:camera:start', async (event, request) => {
  if (!trusted(event)) throw Error('Camera access is unavailable from this page.');
  try { return await host.start(request); }
  catch (error) { return { error: { message: error.message, code: error.code, retryable: Boolean(error.retryable) } }; }
 });
 ipcMain.handle('inflect:camera:stop', async (event, id) => {
  if (!trusted(event)) throw Error('Camera access is unavailable from this page.');
  if (typeof id !== 'string') return;
  return host.stop(id);
 });
 const release = () => { void host.stop().catch(() => {}); };
 const navigate = (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame) release(); };
 wc.on('did-start-navigation', navigate);
 wc.on('render-process-gone', release);
 window.once('closed', () => {
  ipcMain.removeHandler('inflect:camera:start');
  ipcMain.removeHandler('inflect:camera:stop');
  wc.removeListener('did-start-navigation', navigate);
  wc.removeListener('render-process-gone', release);
  release();
 });
 return host;
}
module.exports = { NativeCameraHost, bindNativeCameraIpc };
