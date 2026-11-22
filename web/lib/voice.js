const STORAGE_KEY = 'inflect.voice.v1';
const defaults = { enabled: true, volume: 0.8, rate: 0.95, voiceURI: '' };
const clamp = (x, min, max, fallback) => Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : fallback;
function localSettings() { try { return globalThis.localStorage; } catch { return null; } }

export function readVoiceSettings(storage = localSettings()) {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
    return {
      enabled: typeof value?.enabled === 'boolean' ? value.enabled : defaults.enabled,
      volume: clamp(value?.volume, 0, 1, defaults.volume),
      rate: clamp(value?.rate, 0.85, 1.15, defaults.rate),
      voiceURI: typeof value?.voiceURI === 'string' ? value.voiceURI.slice(0, 300) : '',
    };
  } catch { return { ...defaults }; }
}

export function chooseGuideVoice(voices, preferredURI = '') {
  if (!Array.isArray(voices)) return null;
  const preferred = voices.find(v => v.voiceURI === preferredURI);
  if (preferred) return preferred;
  const english = voices.filter(v => /^en(?:[-_]|$)/i.test(v.lang || ''));
  const rank = v => (/natural|neural|enhanced|premium/i.test(v.name) ? 12 : 0) + (/google|microsoft|samantha|daniel|karen/i.test(v.name) ? 3 : 0) + (v.localService ? 1 : 0) + (v.default ? 2 : 0);
  return [...english].sort((a, b) => rank(b) - rank(a))[0] || voices.find(v => v.default) || voices[0] || null;
}

export class VoiceGuide {
  constructor({ engine = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, storage = localSettings(), onChange = () => {} } = {}) {
    this.engine = engine;
    this.Utterance = Utterance;
    this.storage = storage;
    this.onChange = onChange;
    this.settings = readVoiceSettings(storage);
    this.supported = !!engine && typeof engine.speak === 'function' && typeof Utterance === 'function';
    this.armed = false;
    this.failed = '';
    this.speaking = false;
    this.voices = [];
    this.serial = 0;
    this.lastId = '';
    this.current = null;
    this.refresh = () => {
      try { this.voices = this.engine?.getVoices() || []; } catch { this.voices = []; }
      if (this.voices.length) this.failed = '';
      this.onChange(this);
    };
    this.engine?.addEventListener?.('voiceschanged', this.refresh);
    this.refresh();
  }
  get canSpeak() { return this.supported && this.armed && this.settings.enabled && this.settings.volume > 0 && !this.failed; }
  get label() { return !this.supported || this.failed ? 'Voice unavailable' : !this.settings.enabled || this.settings.volume === 0 ? 'Voice off' : 'Voice on'; }
  save() {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify({ enabled: this.settings.enabled, volume: this.settings.volume, rate: this.settings.rate, voiceURI: this.settings.voiceURI })); } catch { /* Settings are optional; practice still works. */ }
    this.onChange(this);
  }
  activate() {
    // Called from an explicit user action. Never speak on page load.
    this.armed = true;
    try { this.engine?.resume(); } catch {}
  }
  setEnabled(enabled) { this.settings.enabled = !!enabled; if (!enabled) this.stop(); else this.failed = ''; this.save(); }
  setVolume(value) { this.settings.volume = clamp(Number(value), 0, 1, defaults.volume); if (!this.settings.volume) this.stop(); this.save(); }
  setRate(value) { this.settings.rate = clamp(Number(value), 0.85, 1.15, defaults.rate); this.save(); }
  setVoice(uri) { this.settings.voiceURI = typeof uri === 'string' ? uri.slice(0, 300) : ''; this.failed = ''; this.stop(); this.save(); }
  stop() {
    this.serial++;
    this.current = null;
    this.lastId = '';
    this.speaking = false;
    try { this.engine?.cancel(); } catch {}
    this.onChange(this);
  }
  speak(text, { id = '', force = false } = {}) {
    if (!this.canSpeak || typeof text !== 'string' || !text.trim()) return false;
    if (!force && id && this.lastId === id) return false;
    this.stop();
    const serial = this.serial;
    this.lastId = id;
    const utterance = new this.Utterance(text.slice(0, 200));
    const selected = chooseGuideVoice(this.voices, this.settings.voiceURI);
    if (selected) { utterance.voice = selected; utterance.lang = selected.lang; } else utterance.lang = 'en-US';
    utterance.volume = this.settings.volume;
    utterance.rate = this.settings.rate;
    utterance.pitch = 1;
    utterance.onstart = () => { if (serial === this.serial) { this.speaking = true; this.onChange(this); } };
    utterance.onend = () => { if (serial === this.serial) { this.speaking = false; this.current = null; this.onChange(this); } };
    utterance.onerror = event => {
      if (serial !== this.serial || ['canceled', 'interrupted'].includes(event.error)) return;
      this.speaking = false;
      this.current = null;
      this.failed = 'Your device could not play a speech voice. The written cues are still available.';
      this.onChange(this);
    };
    this.current = utterance;
    try { this.engine.resume?.(); this.engine.speak(utterance); return true; }
    catch { this.failed = 'Speech is unavailable on this device. Follow the written cues instead.'; this.current = null; this.onChange(this); return false; }
  }
  retry(text = 'I’ll guide the timing. You can keep your eyes on the camera.') {
    this.activate(); this.failed = ''; this.settings.enabled = true; this.save();
    return this.speak(text, { id: 'voice-test', force: true });
  }
  dispose() { this.stop(); this.engine?.removeEventListener?.('voiceschanged', this.refresh); }
}
