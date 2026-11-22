import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceGuidance, restingGuidance } from '../web/lib/guidance.js';

test('spoken cues, captions and movement targets agree at every prompt boundary', () => {
  const start = practiceGuidance('raised', 0); assert.equal(start.id, 'ready'); assert.equal(start.remaining, 3);
  const lift = practiceGuidance('raised', 3); assert.equal(lift.target, 'raised'); assert.match(lift.speech, /raise/);
  const rest = practiceGuidance('raised', 7); assert.equal(rest.target, 'neutral'); assert.match(rest.speech, /Relax/);
  const change = practiceGuidance('contrast', 10); assert.equal(change.target, 'furrowed'); assert.match(change.speech, /furrow/);
});
test('phase identity distinguishes repeated cues and rests', () => {
  assert.notEqual(practiceGuidance('raised', 3).id, practiceGuidance('raised', 10).id);
  assert.notEqual(practiceGuidance('raised', 7).id, practiceGuidance('raised', 14).id);
});
test('countdown and progress are bounded and complete cleanly', () => {
  assert.equal(practiceGuidance('raised', 3.1).remaining, 4);
  assert.equal(practiceGuidance('raised', 6.99).remaining, 1);
  assert.equal(practiceGuidance('raised', -10).progress, 0);
  const done = practiceGuidance('raised', 40); assert.equal(done.progress, 100); assert.equal(done.remaining, 0); assert.equal(done.id, 'complete');
});
test('idle guidance states the selected exercise without fabricating observations', () => {
  const g = restingGuidance({ id: 'furrowed', instruction: 'Gently furrow your brows.' });
  assert.equal(g.target, 'furrowed'); assert.equal(g.remaining, null); assert.match(g.detail, /Two short cues/);
});
