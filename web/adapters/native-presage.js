export class NativePresageSource {
 constructor(callbacks, { bridge, makeId = () => globalThis.crypto.randomUUID() } = {}) {
  Object.assign(this, callbacks);
  this.bridge = bridge;
  this.makeId = makeId;
  this.generation = 0;
  this.id = null;
  this.unsubscribe = null;
  this.stopping = Promise.resolve();
  this.errorTimer = null;
 }
 async start(key) {
  if (!key?.trim()) throw Error('Enter your Presage API key.');
  const stopping = this.stop();
  const generation = this.generation;
  await stopping;
  if (generation !== this.generation) return;
  const id = this.id = this.makeId();
  let failed = '', running = false;
  const current = () => generation === this.generation && this.id === id;
  const fail = (message, details = {}) => {
   if (!current() || failed) return;
   failed = String(message || 'Presage could not continue. Reconnect to try again.').split(key.trim()).join('[hidden]');
   this.onError?.(failed, details);
  };
  this.unsubscribe = this.bridge.subscribe(event => {
   if (!current() || event?.id !== id || failed) return;
   switch (event.kind) {
    case 'sample': this.onSample?.(event.frame); break;
    case 'validationStatus': this.onStatus?.(event.hint || '', { validationCode: event.code }); break;
    case 'processingStatus':
     if (event.status === 3) {
      running = true;
      this.onStatus?.('Tracking is starting. Keep your face visible.');
     }
     if (event.status === 2) this.onStatus?.('Presage is starting. Wait for clear tracking before capturing.');
     if (running && (event.status === 1 || event.status === 4)) fail('Presage processing stopped. Reconnect live feedback to calibrate again.', { status: event.status });
     // Allow the detailed error event to arrive first; still recover if only a terminal state arrives.
     if (event.status === 5) {
      clearTimeout(this.errorTimer);
      this.errorTimer = setTimeout(() => fail('Presage processing stopped. Reconnect live feedback to calibrate again.', { status: 5 }), 100);
     }
     break;
    case 'error': fail(event.message, { code: event.code, retryable: event.retryable }); break;
   }
  });
  try {
   const result = await this.bridge.start({ id, key: key.trim() });
   if (!current()) return;
   if (result?.error) {
    fail(result.error.message, result.error);
    throw Error(failed);
   }
   if (failed) throw Error(failed);
   if (result?.cancelled) { await this.stop(); return; }
   this.onCameraSettings?.(result.camera);
   this.onCameraActive?.(true);
  } catch (error) {
   if (current()) await this.stop();
   throw error;
  }
 }
 stop() {
  this.generation++;
  clearTimeout(this.errorTimer);
  this.errorTimer = null;
  const id = this.id, unsubscribe = this.unsubscribe;
  this.id = null;
  this.unsubscribe = null;
  unsubscribe?.();
  this.onCameraActive?.(false);
  if (!id) return this.stopping;
  let stopped;
  try { stopped = this.bridge.stop(id); } catch (error) { stopped = Promise.reject(error); }
  this.stopping = Promise.allSettled([this.stopping, stopped]).then(() => {});
  return this.stopping;
 }
}
