import { cueAt } from './session.js';

const PHASES = [
  { id: 'ready', start: 0, end: 3 },
  { id: 'first', start: 3, end: 7 },
  { id: 'rest-one', start: 7, end: 10 },
  { id: 'second', start: 10, end: 14 },
  { id: 'rest-two', start: 14, end: 18 },
  { id: 'settle', start: 18, end: 20 },
];

export function practiceGuidance(lessonId, seconds) {
  const t = Math.max(0, Math.min(20, Number.isFinite(seconds) ? seconds : 0));
  if (t >= 20) return { id: 'complete', target: 'neutral', title: 'A little practice, complete.', detail: 'Take a look at your session, then try again.', speech: 'Practice complete. Take a look at your session.', remaining: 0, progress: 100 };
  const phase = PHASES.find(p => t >= p.start && t < p.end);
  const target = cueAt(lessonId, t);
  const ready = phase.id === 'ready', settle = phase.id === 'settle';
  const title = ready ? 'Get ready.' : target === 'raised' ? 'Gently raise your brows.' : target === 'furrowed' ? 'Gently furrow your brows.' : 'Let your brows rest.';
  const detail = ready ? 'Look at the guide. Keep your head comfortable and level.' : settle ? 'One last moment to relax before your review.' : target === 'neutral' ? 'Release the movement. A relaxed interval is part of the drill.' : 'Hold the movement comfortably until the prompt changes.';
  const speech = ready ? 'Get ready. Relax your brows.' : settle ? 'Almost done. Relax.' : target === 'raised' ? 'Gently raise your brows.' : target === 'furrowed' ? 'Gently furrow your brows.' : 'Relax your brows.';
  return { ...phase, title, detail, target, speech, remaining: Math.ceil(phase.end - t), progress: t / 20 * 100 };
}

export function restingGuidance(lesson) {
  return { id: 'idle', target: lesson.id === 'furrowed' ? 'furrowed' : 'raised', title: 'See what changes. Then try it.', detail: lesson.instruction + ' Two short cues, with time to relax.', remaining: null, progress: 0 };
}
