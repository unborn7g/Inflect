import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceGuide, readVoiceSettings, chooseGuideVoice } from '../web/lib/voice.js';

function storage(initial = null) {
  let data = initial;
  return { getItem: () => data, setItem: (_key, value) => { data = value; }, value: () => data };
}
class Utterance { constructor(text) { this.text = text; } }
function fixture(voices = [{ name: 'Local English', lang: 'en-GB', voiceURI: 'local-en', localService: true }]) {
  const listeners = new Map();
  const engine = {
    calls: [], cancels: 0, voices,
    getVoices() { return this.voices; },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
    resume() {},
    cancel() { this.cancels++; },
    speak(utterance) { this.calls.push(utterance); utterance.onstart?.(); },
  };
  const saved = storage();
  const guide = new VoiceGuide({ engine, Utterance, storage: saved });
  return { guide, engine, saved, listeners };
}

test('voice never speaks before a user action arms it', () => {
  const { guide, engine } = fixture();
  assert.equal(guide.speak('Get ready.', { id: 'ready' }), false);
  assert.equal(engine.calls.length, 0);
  guide.activate();
  assert.equal(guide.speak('Get ready.', { id: 'ready' }), true);
});
test('a held cue is spoken once rather than on every animation frame', () => {
  const { guide, engine } = fixture(); guide.activate();
  for (let i = 0; i < 50; i++) guide.speak('Raise your brows.', { id: 'first' });
  assert.equal(engine.calls.length, 1);
  guide.speak('Relax.', { id: 'rest-one' });
  assert.equal(engine.calls.length, 2);
});
test('a new cue cancels old speech instead of building a queue', () => {
  const { guide, engine } = fixture(); guide.activate();
  guide.speak('Raise.', { id: 'first' }); const cancels = engine.cancels;
  guide.speak('Relax.', { id: 'rest' });
  assert.equal(engine.cancels, cancels + 1);
  assert.equal(guide.current.text, 'Relax.');
});
test('muting stops speech immediately and prevents further cues', () => {
  const { guide, engine } = fixture(); guide.activate(); guide.speak('Raise.');
  const cancels = engine.cancels; guide.setEnabled(false);
  assert.equal(engine.cancels, cancels + 1); assert.equal(guide.current, null);
  assert.equal(guide.speak('Relax.'), false); assert.equal(guide.label, 'Voice off');
});
test('zero volume is silent and supplied volume/rate are applied', () => {
  const { guide, engine } = fixture(); guide.activate(); guide.setVolume(0);
  assert.equal(guide.speak('Raise.'), false);
  guide.setVolume(0.4); guide.setRate(0.9); guide.speak('Raise.');
  assert.equal(engine.calls.at(-1).volume, 0.4); assert.equal(engine.calls.at(-1).rate, 0.9);
});
test('pause or navigation can cancel everything and resume only the current cue', () => {
  const { guide, engine } = fixture(); guide.activate(); guide.speak('Raise.', { id: 'first' });
  guide.stop(); assert.equal(guide.current, null); assert.equal(guide.speaking, false);
  guide.speak('Relax.', { id: 'rest-one' });
  assert.equal(engine.calls.at(-1).text, 'Relax.');
});
test('late events from a cancelled utterance cannot change the new state', () => {
  const { guide, engine } = fixture(); guide.activate(); guide.speak('Raise.'); const old = engine.calls[0];
  guide.speak('Relax.'); old.onend(); old.onerror({ error: 'synthesis-failed' });
  assert.equal(guide.current.text, 'Relax.'); assert.equal(guide.speaking, true); assert.equal(guide.failed, '');
});
test('speech failure falls back cleanly and a user can retry', () => {
  const { guide, engine } = fixture(); guide.activate(); guide.speak('Raise.');
  engine.calls.at(-1).onerror({ error: 'voice-unavailable' });
  assert.equal(guide.label, 'Voice unavailable'); assert.equal(guide.speak('Relax.'), false);
  assert.equal(guide.retry(), true); assert.equal(guide.failed, '');
});
test('normal cancellation is not reported as a device error', () => {
  const { guide, engine } = fixture(); guide.activate(); guide.speak('Raise.');
  engine.calls[0].onerror({ error: 'interrupted' }); assert.equal(guide.failed, '');
});
test('unsupported devices retain a safe no-speech state', () => {
  const guide = new VoiceGuide({ engine: null, Utterance: null, storage: null });
  guide.activate(); assert.equal(guide.speak('Raise.'), false); assert.equal(guide.label, 'Voice unavailable');
  assert.doesNotThrow(() => guide.stop());
});
test('voices that load later become available without recreating the app', () => {
  const { guide, engine, listeners } = fixture([]);
  engine.voices = [{ voiceURI: 'new', lang: 'en-US', name: 'New voice' }];
  listeners.get('voiceschanged')();
  guide.activate(); guide.speak('Ready.'); assert.equal(engine.calls[0].voice.voiceURI, 'new');
});
test('voice preference is respected, otherwise automatic selection prefers English', () => {
  const voices = [{ name: 'Default Spanish', voiceURI: 'es', lang: 'es-ES', default: true }, { name: 'English Natural', voiceURI: 'en', lang: 'en-GB' }];
  assert.equal(chooseGuideVoice(voices).voiceURI, 'en');
  assert.equal(chooseGuideVoice(voices, 'es').voiceURI, 'es');
  assert.equal(chooseGuideVoice([], 'missing'), null);
});
test('invalid saved settings are constrained and unknown fields are not persisted', () => {
  const saved = storage(JSON.stringify({ enabled: false, volume: 20, rate: -2, voiceURI: 'en', apiKey: 'DO_NOT_SAVE' }));
  const options = readVoiceSettings(saved);
  assert.deepEqual(options, { enabled: false, volume: 1, rate: 0.85, voiceURI: 'en' });
  const { engine } = fixture(); const guide = new VoiceGuide({ engine, Utterance, storage: saved });
  guide.setVolume(0.4);
  assert.equal(saved.value().includes('DO_NOT_SAVE'), false);
  assert.deepEqual(Object.keys(JSON.parse(saved.value())).sort(), ['enabled', 'rate', 'voiceURI', 'volume'].sort());
});
test('blocked or corrupt settings storage does not break practice', () => {
  assert.equal(readVoiceSettings(storage('{oops')).enabled, true);
  const { engine } = fixture();
  const guide = new VoiceGuide({ engine, Utterance, storage: { getItem() { throw Error(); }, setItem() { throw Error(); } } });
  assert.doesNotThrow(() => guide.setVolume(0.5));
});
test('disposing cancels speech and unregisters the voices listener', () => {
  const { guide, listeners } = fixture(); guide.activate(); guide.speak('Raise.'); guide.dispose();
  assert.equal(listeners.size, 0); assert.equal(guide.current, null);
});
