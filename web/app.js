import { icon, browIcon } from "./icons.js";
import { faceIllustration, setFaceState } from "./illustration.js";
import { LESSONS } from "./lessons.js";
import { LandmarkGate, buildCalibration, classifyBrow, FACE_POINTS } from "./lib/signal.js";
import { PracticeClock, WINDOWS, cueAt, samplePreview, fillPreviewTrace, summarizeAttempt } from "./lib/session.js";
import { readHistory, saveAttempt, clearHistory } from "./lib/store.js";
import { desktopAvailable, PresageSource } from "./adapters/presage.js";
import { drawLandmarks } from './lib/landmark-view.js';
import { VoiceGuide } from "./lib/voice.js";
import { practiceGuidance, restingGuidance } from "./lib/guidance.js";
const $ = (s2) => document.querySelector(s2), esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const s = { page: "practice", lessonId: "raised", mode: "idle", status: "idle", stream: null, source: null, nativeCamera: false, cameraSettings: null, validationCode: 0, cal: null, gate: new LandmarkGate(), observed: { valid: false }, samples: 0, clock: new PracticeClock(), trace: [], report: null, attempt: null, guide: false, guideStart: 0, paint: 0, banner: "", capture: null, calStep: 0, calSamples: { neutral: [], raised: [], furrowed: [] }, saveFailed: false, focus: false, watched: false };
let modalPurpose = "", modalFocus = null, toastTimer, generation = 0;
let cameraStopping = Promise.resolve(), connecting = 0;
const voice = new VoiceGuide();
voice.onChange = () => updateVoiceControls();
const lesson = () => LESSONS.find((l) => l.id === s.lessonId) || LESSONS[0];
const modeName = () => s.mode === "live" ? "Presage live" : s.mode === "mirror" ? "Mirror practice" : s.mode === "preview" ? "Illustrated preview" : desktopAvailable() ? "Desktop studio" : "Browser studio";
const btn = (action2, text, glyph = "", cls = "btn-secondary", extra = "") => `<button class="btn ${cls}" data-action="${action2}" ${extra}>${glyph ? icon(glyph) : ""}${text}</button>`;
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").hidden = true, 5e3);
}
function footer() {
  return `<footer class="page-footer"><span>Facial-movement practice, with ASL context.<span class="footer-review">Educator review pending.</span></span><button data-action="privacy">${icon("shield")}Privacy & data</button></footer>`;
}

function practiceToolbar() {
  return `<div class="practice-toolbar"><div class="room-label"><span class="room-mark">${icon('practice')}</span><span>The practice room</span></div><div class="studio-tools"><button class="focus-button" data-action="focus" id="focus-button" aria-pressed="${s.focus}">${icon('expand')}<span>${s.focus ? 'Exit focus' : 'Focus view'}</span></button><div class="voice-controls" aria-label="Spoken guidance"><button class="voice-toggle" id="voice-toggle" data-action="toggle-voice" aria-pressed="false">${icon('volume')}<span>Voice on</span></button><label class="voice-volume"><span class="sr-only">Practice voice volume</span><input id="voice-volume" type="range" min="0" max="100" step="5" value="${Math.round(voice.settings.volume * 100)}" aria-label="Practice voice volume"></label><button class="icon-button" data-action="voice-settings" aria-label="Voice settings" title="Voice settings">${icon('settings')}</button></div></div></div>`;
}

function cuePanel() {
  return `<section class="session-cue" id="session-cue" aria-label="Current practice instruction"><div class="cue-copy"><p class="cue-kicker" id="cue-kicker">YOUR NEXT STEP</p><h2 id="cue-title" aria-live="polite"></h2><p id="cue-detail"></p></div><div class="cue-clock"><div class="cue-number" id="cue-number" aria-hidden="true">${browIcon(s.lessonId)}</div><div class="cue-duration" id="cue-duration">20 seconds</div></div><div class="session-progress" role="progressbar" id="session-progress" aria-label="Practice progress" aria-valuemin="0" aria-valuemax="20" aria-valuenow="0"><span id="session-progress-fill"></span></div></section>`;
}

function updateVoiceControls() {
  const el = $('#voice-toggle');
  if (el) {
    if (el.dataset.state !== voice.label) { el.innerHTML = `${icon(voice.label === 'Voice on' ? 'volume' : 'volumeOff')}<span>${voice.label}</span>`; el.dataset.state = voice.label; }
    el.setAttribute('aria-pressed', String(voice.settings.enabled && voice.settings.volume > 0 && !voice.failed && voice.supported));
    el.disabled = !voice.supported;
    el.title = !voice.supported ? 'Speech is not supported on this device. Written cues stay available.' : voice.failed ? 'Open voice settings to test another voice.' : 'Turn spoken practice cues on or off';
  }
  const caption = $('#cue-title');
  if (caption) caption.setAttribute('aria-live', voice.canSpeak ? 'off' : 'polite');
  const note = $('#voice-fallback');
  if (note) {
    note.hidden = voice.supported && !voice.failed;
    const text = voice.failed || 'This device does not support speech guidance. Follow the written cues; practice works with sound off.';
    if (note.textContent !== text) note.textContent = text;
  }
  const volume = $('#voice-volume');
  if (volume && document.activeElement !== volume) volume.value = String(Math.round(voice.settings.volume * 100));
  if (modalPurpose === 'voice') {
    const status = $('#voice-status');
    if (status) status.textContent = voice.failed || (!voice.supported ? 'Speech guidance is unavailable on this device.' : voice.speaking ? 'Playing a sample with your selected voice.' : voice.voices.length ? 'Choose a voice and try a sample.' : 'Using your device’s default voice. Availability depends on this browser.');
    const percent = $('#voice-percent');
    if (percent) percent.textContent = Math.round(voice.settings.volume * 100) + '%';
    const select = $('#guide-voice');
    if (select && document.activeElement !== select) {
      const options = voiceOptions();
      if (select.innerHTML !== options) select.innerHTML = options;
    }
  }
}
function voiceOptions() {
  const choices = voice.voices.filter(v => /^en(?:[-_]|$)/i.test(v.lang) || v.voiceURI === voice.settings.voiceURI);
  return `<option value="">Automatic · device voices</option>${choices.map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === voice.settings.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}`;
}
function voiceSettings() {
  modal('A voice at your pace.', `<p>Short spoken cues let you keep your eyes on the guide or camera. Written prompts are always available.</p><label class="field-label" for="guide-voice">Guide voice</label><div class="select-wrap"><select id="guide-voice" ${!voice.supported ? 'disabled' : ''}>${voiceOptions()}</select>${icon('chevronDown')}</div><label class="field-label" for="voice-rate">Speaking pace</label><div class="select-wrap"><select id="voice-rate"><option value="0.9" ${voice.settings.rate === 0.9 ? 'selected' : ''}>Gentle</option><option value="0.95" ${voice.settings.rate === 0.95 ? 'selected' : ''}>Comfortable</option><option value="1.1" ${voice.settings.rate === 1.1 ? 'selected' : ''}>Brisk</option></select>${icon('chevronDown')}</div><label class="field-label volume-label" for="voice-modal-volume">Voice volume <span id="voice-percent">${Math.round(voice.settings.volume * 100)}%</span></label><input class="modal-volume" id="voice-modal-volume" type="range" min="0" max="100" step="5" value="${Math.round(voice.settings.volume * 100)}"><p class="field-help" id="voice-status"></p><div class="modal-actions">${btn('test-voice', 'Test voice', 'volume', 'btn-secondary', !voice.supported ? 'disabled' : '')}${btn('close-modal', 'Done', '', 'btn-primary')}</div><p class="modal-note">Uses speech voices supplied by your browser or system. Some voices need a network connection. Only fixed practice instructions are spoken; face data and keys are never sent to the speech service.</p>`, 'voice');
  updateVoiceControls();
}
function currentGuidance() {
  if (s.status === 'complete' && !s.guide) return practiceGuidance(s.lessonId, 20);
  if (s.guide) return practiceGuidance(s.lessonId, ((performance.now() - s.guideStart) / 1000) % 20);
  if (s.status === 'running' || s.status === 'paused') return practiceGuidance(s.lessonId, s.clock.time(performance.now()));
  const resting = restingGuidance(lesson());
  return s.watched ? { ...resting, title: 'Your turn when you’re ready.', detail: 'Use your camera and follow the same short cues. Start comfortably.' } : resting;
}
function updateGuidance(g = currentGuidance()) {
  const panel = $('#session-cue');
  if (!panel) return;
  const paused = s.status === 'paused' && !s.guide;
  const running = s.clock.running || s.guide;
  const stage = s.status === 'complete' && !s.guide ? 'review' : s.guide || (s.mode === 'idle' && !s.watched) ? 'watch' : 'practice';
  for (const step of document.querySelectorAll('[data-step]')) {
    if (step.dataset.step === stage) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
  }
  panel.classList.toggle('is-active', running);
  panel.classList.toggle('is-paused', paused);
  $('#cue-kicker').textContent = paused ? 'TAKE YOUR TIME' : s.guide ? 'WATCH THE GUIDE' : s.status === 'complete' ? 'YOUR REVIEW' : running ? g.id === 'ready' ? 'A MOMENT TO GET READY' : g.target === 'neutral' ? 'RELAX BETWEEN CUES' : 'FOLLOW THE CUE' : s.watched ? 'YOUR TURN' : 'YOUR NEXT STEP';
  const title = paused ? 'Practice paused.' : g.title;
  if ($('#cue-title').textContent !== title) $('#cue-title').textContent = title;
  const detail = paused ? 'Resume when you’re comfortable. Your place is saved.' : g.detail;
  if ($('#cue-detail').textContent !== detail) $('#cue-detail').textContent = detail;
  const number = running && g.remaining !== null ? String(g.remaining) : paused ? icon('pause') : s.status === 'complete' ? icon('check') : browIcon(s.lessonId);
  if ($('#cue-number').innerHTML !== number) $('#cue-number').innerHTML = number;
  $('#cue-duration').textContent = running ? g.id === 'ready' ? 'Ready in ' + g.remaining + 's' : g.remaining + 's ' + (g.target === 'neutral' ? 'to relax' : 'to hold') : s.status === 'complete' ? '20 seconds · complete' : paused ? 'Paused' : '20 seconds · two cues';
  $('#session-progress-fill').style.width = g.progress + '%';
  $('#session-progress').setAttribute('aria-valuenow', String(Math.round(g.progress / 5)));
  updateVoiceControls();
}
function speakCurrentCue(force = false) {
  const g = currentGuidance();
  if (s.clock.running || s.guide) voice.speak(g.speech, { id: (s.guide ? 'guide:' + Math.floor((performance.now() - s.guideStart) / 20000) : 'practice') + ':' + g.id, force });
}
function focusReview() {
  const review = $('#results-title');
  if (!review) return;
  review.focus({ preventScroll: true });
  review.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function render() {
  const history = readHistory();
  $("#app").innerHTML = `<div class="workspace ${s.focus && s.page === 'practice' ? 'focus-view' : ''}"><header class="site-header"><a class="brand" href="#practice" data-action="nav" data-page="practice" aria-label="Inflect home"><span class="brand-mark">${browIcon('raised')}</span><span>inflect<span class="brand-stop">.</span></span></a><nav class="main-nav" aria-label="Studio navigation">${[["practice", "practice", "Practice"], ["history", "history", "My sessions"], ["resources", "book", "Field notes"], ["setup", "laptop", "Desktop setup"]].map(([page, glyph, name]) => `<button class="nav-item ${s.page === page ? 'active' : ''}" data-action="nav" data-page="${page}" aria-label="${name}" ${s.page === page ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${name}</span>${page === 'history' && history.length ? `<small class="nav-count">${history.length}</small>` : ''}</button>`).join('')}</nav><div class="header-end"><span class="mode-tag ${s.mode === 'live' ? 'live' : ''}" id="mode-tag">${modeName()}</span><button class="icon-button" data-action="how" aria-label="How it works" title="How it works">${icon('help')}</button></div></header><main class="content ${s.page === 'practice' ? 'practice-content' : 'secondary-content'}" id="main" tabindex="-1">${s.page === 'practice' ? practice() : s.page === 'history' ? historyPage(history) : s.page === 'resources' ? resources() : setup()}${footer()}</main></div>`;
  if (s.page === 'practice') {
    attach();
    setFaceState($('#guide-face'), s.lessonId === 'furrowed' ? 'furrowed' : 'raised');
    chart();
    update();
  }
}

function practice() {
  const l = lesson();
  return `<header class="practice-heading"><div><p class="eyebrow">ASL FACIAL EXPRESSION PRACTICE</p><h1>Let your face <em>ask the question.</em></h1></div><p class="heading-note">A little attention to the part<br>your hands can’t do.</p></header><div class="lesson-tabs" role="tablist" aria-label="Choose a movement drill">${LESSONS.map((item) => `<button class="lesson-tab ${item.id === s.lessonId ? 'active' : ''}" role="tab" id="tab-${item.id}" aria-selected="${item.id === s.lessonId}" tabindex="${item.id === s.lessonId ? '0' : '-1'}" aria-controls="drill-content" data-action="lesson" data-lesson="${item.id}"><span class="lesson-symbol">${browIcon(item.id)}</span><span><strong>${item.short}</strong><small>${item.label.toLowerCase()}</small></span>${icon('check','lesson-check')}</button>`).join('')}</div><section class="lesson-layout" id="drill-content" role="tabpanel" aria-labelledby="tab-${l.id}"><aside class="lesson-brief" aria-label="About this practice"><div class="lesson-brief-top"><p class="eyebrow">THE IDEA BEHIND THE MOVEMENT</p><h2>${l.title}</h2><p class="lesson-context">${l.context}</p></div><div class="question-example"><span>${l.exampleLabel}</span><p>${l.example}</p><small>English context only. This illustration does not teach the complete sign.</small></div><div class="practice-intention">${browIcon(l.id)}<div><h3>Keep in mind</h3><p>${l.takeaway}</p></div></div><div class="lesson-plan"><h3>A small, focused session</h3><ol class="practice-steps" aria-label="Practice steps"><li data-step="watch">${icon('play')}<div><strong>Watch the movement</strong><span>See what changes.</span></div></li><li data-step="practice">${icon('camera')}<div><strong>Try it yourself</strong><span>20 seconds, two short cues.</span></div></li><li data-step="review">${icon('eye')}<div><strong>Take a closer look</strong><span>Reflect, then repeat.</span></div></li></ol></div><a class="source-link" href="${l.source}" target="_blank" rel="noopener noreferrer">Read the ASL context ${icon('book')}</a><p class="lesson-scope">Brow movement only. Hands and complete ASL sentences aren’t assessed. Prompt durations are for this drill, not a rule for signing.</p></aside><div class="practice-workspace">${practiceToolbar()}<div class="quality-banner" id="quality-banner" role="status" hidden></div><section class="practice-stage" aria-label="Movement practice">${cuePanel()}<div class="practice-grid"><article class="guide-panel"><header class="panel-header"><h3>Follow the movement</h3><span class="panel-label">BROW GUIDE</span></header><div class="art-container">${faceIllustration('guide-face')}<div class="guide-cue"><span class="cue-chip" id="guide-cue">${l.instruction}</span></div></div><div class="guide-footer"><span>Original movement illustration</span><button class="mini-button" data-action="watch" id="watch-button" aria-pressed="false">${icon('play')}Watch guide</button></div></article><article class="mirror-panel"><header class="panel-header"><h3>Your practice space</h3><span class="camera-state" id="camera-state">${icon('cameraOff')}Camera off</span></header><div class="camera-zone" id="camera-zone">${cameraContent()}</div></article></div><div class="stage-bottom"><p class="camera-footnote">${icon('shield')}Your video is never recorded.</p><button class="mini-button" data-action="camera">${icon(cameraActive() ? 'cameraOff' : 'settings')}${cameraActive() ? 'Stop camera' : 'Camera options'}</button></div><div class="practice-controls"><span class="controls-status" id="controls-status"></span><div class="controls-buttons" id="control-buttons"></div></div></section><p class="voice-fallback" id="voice-fallback" role="status" hidden></p><div class="practice-afterword">${icon('eye')}<p><strong>Notice the change.</strong> ${esc(l.notice)}</p><span class="duration-note">20-second practice</span></div><div id="results-container">${s.report ? results() : ''}</div><details class="timeline-panel" id="session-timeline"><summary><span>${icon('signal')}Session timeline</span><span class="timer-display"><strong id="timer-value">00:00</strong> / 00:20 ${icon('chevronDown')}</span></summary><div class="timeline-content"><p id="timeline-description">The shaded windows show when to follow the cue.</p><div class="timeline-chart"><div class="chart-labels"><span>Prompt</span><span>Movement</span></div><svg class="chart-surface" id="timeline" viewBox="0 0 1000 88" preserveAspectRatio="none" role="img" aria-label="Twenty-second prompt timeline"></svg></div></div></details><details class="diagnostics"><summary>${icon('settings')}Connection details</summary><dl><div><dt>Source</dt><dd id="diag-source"></dd></div><div><dt>Landmark samples</dt><dd id="diag-samples">${s.samples}</dd></div><div><dt>Calibration</dt><dd id="diag-calibration"></dd></div><div><dt>Camera setting</dt><dd id="diag-camera"></dd></div><div><dt>Tracking</dt><dd id="diag-tracking">Not measuring</dd></div></dl></details></div></section>`;
}

function cameraContent() {
  if (s.nativeCamera) return `<canvas class="camera-landmarks" id="camera-overlay" width="640" height="480" aria-label="Your live face landmarks, mirrored"></canvas><span class="camera-live-tag live">${icon('signal')}Presage · live landmarks</span><p class="landmark-status" id="landmark-status">Waiting for clear tracking…</p><div class="camera-cue"><span id="camera-cue-text">Follow the guide at your own pace.</span></div>`;

  if (s.mode === 'preview') return `<div class="preview-art">${faceIllustration('learner-face','learner')}</div><span class="camera-live-tag">Illustrated example</span><span class="preview-watermark">Sample data · no camera</span><div class="camera-cue"><span id="camera-cue-text">Example movement, not a camera measurement.</span></div>`;
  if (s.stream) return `<video class="camera-video" id="camera-video" autoplay muted playsinline aria-label="Your mirrored camera preview"></video><canvas class="camera-overlay" id="camera-overlay" aria-hidden="true"></canvas><span class="camera-live-tag ${s.mode === 'live' ? 'live' : ''}">${icon(s.mode === 'live' ? 'signal' : 'camera')}${s.mode === 'live' ? 'Presage · live movement' : 'Camera mirror · self-review'}</span><div class="camera-cue"><span id="camera-cue-text">Follow the guide at your own pace.</span></div>`;
  return `<div class="camera-frame" aria-hidden="true"><span></span><span></span><span></span><span></span></div><div class="camera-empty"><span class="camera-symbol">${icon('camera')}</span><h3>Make this space yours.</h3><p>${desktopAvailable() ? 'Connect for live feedback, or use a camera mirror.' : 'Use your camera as a mirror beside the guide.'}</p>${btn(desktopAvailable() ? 'choose-mode' : 'mirror-consent', 'Use my camera', 'camera', 'btn-primary')}<button class="empty-preview-link" data-action="preview">Explore a sample session</button><small>${desktopAvailable() ? 'Your camera starts after permission.' : 'Mirror mode · you review your own movement.'}</small></div>`;
}

function results() {
  const preview = (s.attempt?.mode || s.mode) === 'preview';
  const mirror = (s.attempt?.mode || s.mode) === 'mirror';
  return `<section class="results ${preview ? 'sample-results' : ''}" aria-labelledby="results-title"><div class="review-kicker">${icon(mirror ? 'eye' : 'check')}<span>${preview ? 'ILLUSTRATED EXAMPLE' : 'YOUR SESSION REVIEW'}</span></div><h2 class="results-heading" id="results-title" tabindex="-1">${mirror ? 'What did you notice?' : preview ? 'Here’s how a review works.' : 'A closer look at your timing.'}</h2><p>${mirror ? 'Mirror practice has no automatic assessment. Think back to the movement you saw in your camera.' : preview ? 'These are sample observations to explain the interface. They were not measured from your face.' : 'These observations describe brow movement during the prompts, not your signing or ASL proficiency.'}</p>${mirror ? `<div class="self-review"><h3>Reflect on your practice</h3><p>Did the movement feel different from rest? Did you relax between the two cues? Try one comfortable change in your next session.</p></div>` : `<div class="result-list">${s.report.map((r, i) => `<article class="result-item"><div class="result-item-head"><strong>${i ? 'Second cue' : 'First cue'}</strong><span>${r.target === 'raised' ? 'Raised brows' : 'Furrowed brows'}</span></div><div class="result-value">${r.observed < 1 ? 'Not assessed' : r.matched.toFixed(1) + '<span>s</span>'}<small>${r.observed < 1 ? 'Not enough clear tracking' : 'matching movement in a ' + r.duration + '-second cue'}</small></div><p>${r.observed < 1 ? 'Keep your face in even light and try again. This interval cannot be assessed.' : `${r.observed.toFixed(1)}s had usable tracking. ${r.delay === null ? 'A matching position was not observed.' : r.delay > 0.3 ? `The movement appeared about ${r.delay.toFixed(1)}s after the cue began.` : 'The movement appeared near the start of the cue.'}`}</p></article>`).join('')}</div>`}<div class="results-actions">${btn('retry', 'Practise again', 'replay', 'btn-primary')}${btn('next', 'Try the next movement')}${preview ? '' : btn('export', 'Export session', 'download')}</div><p class="${preview ? 'sample-notice' : 'field-help'}">${preview ? 'Example data only. No camera was used and nothing was saved to My sessions.' : s.saveFailed ? 'Your browser could not save this summary. You can still export it.' : 'Summary saved on this device. No video or face coordinates saved.'}</p></section>`;
}

function historyPage(history) {
  return `<p class="eyebrow">YOUR PRACTICE</p><h1 class="section-title">A little practice adds up.</h1><p class="section-description">Your completed camera sessions, saved on this device. Illustrated walkthroughs stay out of this history.</p>${history.length ? `<div class="history-toolbar"><span>${history.length} completed sessions</span><button class="quiet-button" data-action="clear">${icon("trash")}Clear history</button></div><div class="history-list">${history.map((h) => {
    const l = LESSONS.find((l2) => l2.id === h.lessonId);
    return `<article class="panel history-row"><span class="lesson-symbol">${browIcon(l.id)}</span><div><h3>${l.name}</h3><p>${esc(new Date(h.date).toLocaleString(void 0, { dateStyle: "medium", timeStyle: "short" }))} \xB7 20 seconds</p></div><span class="mode-tag ${h.mode === "live" ? "live" : ""}">${h.mode === "live" ? "Presage live" : "Mirror practice"}</span><button class="quiet-button" data-action="export-history" data-id="${esc(h.id)}">${icon("download")}Export</button></article>`;
  }).join("")}</div>` : `<div class="panel history-empty">${icon("history")}<h2>Your first session belongs here.</h2><p>Complete a camera-mirror or live session to keep a small record of your practice. Your camera video is never recorded.</p>${btn("nav", "Find a cue to practise", "practice", "btn-primary", 'data-page="practice"')}</div>`}`;
}
function resources() {
  return `<p class="eyebrow">CONTEXT MATTERS</p><h1 class="section-title">There\u2019s more to a question.</h1><p class="section-description">These are movement drills with ASL context. The references explain how facial cues fit into the language.</p><div class="library-cards">${[
    ["book", "More than the hands", "ASL uses movements of the face, head and body as well as the hands. Raised and furrowed brows can carry grammatical information. Our drills isolate only brow movement.", "https://www.lifeprint.com/asl101/pages-layout/nonmanualmarkers.htm", "ASL University \xB7 Non-manual markers"],
    ["eye", "The timing changes", "Where a facial cue begins and ends depends on a question\u2019s structure. A timed prompt is not a rule for every question. We do not detect which words you sign.", "https://www.lifeprint.com/asl101/topics/grammar17.htm", "ASL University \xB7 Facial grammar"],
    ["practice", "Feedback needs a teacher", "Educators have called for specific, reviewable feedback and teacher involvement. These drills have not yet been reviewed or endorsed by an ASL educator.", "https://saadh.info/papers/hassan-chi26/hassan-chi26.pdf", "Read the CHI 2026 educator study"],
    ["signal", "What the camera measures", "The desktop app uses Presage landmarks and personal calibration. Our movement labels are engineering observations, not SDK-provided ASL grades or emotion estimates.", "https://smartspectra.presagetech.com/docs/model-cards-and-limitations/", "Presage \xB7 Model cards and limitations"]
  ].map(([glyph, title, text, url, label]) => `<article class="panel resource-card">${icon(glyph)}<h2>${title}</h2><p>${text}</p><a href="${url}" target="_blank" rel="noopener noreferrer">${label} ${icon("external")}</a></article>`).join("")}</div><article class="panel scope-card"><h2>A practice aid, with a clear scope.</h2><p>Inflect does not recognize hands, translate ASL, assess complete sentences, or establish fluency. The original illustrations show brow movements, not signing demonstrations. It complements instruction from qualified teachers.</p><p>All app wording, drill schedules and diagrams are original. External materials are linked rather than copied or embedded. Their authors do not endorse this app.</p></article>`;
}
function setup() {
  return `<p class="eyebrow">A CAMERA. A CLEARER VIEW.</p><h1 class="section-title">Set up live feedback.</h1><p class="section-description">The Presage SDK runs locally in Inflect\u2019s desktop app. The browser studio offers a camera mirror and an illustrated walkthrough.</p><div class="setup-steps"><article class="panel setup-step">${icon("key")}<h3>Get your Presage key</h3><p>Create a free developer account, verify your email, and find your API key in the portal.</p><p style="margin-top:12px"><a href="https://physiology.presagetech.com/auth/register" target="_blank" rel="noopener noreferrer">Open registration ${icon("external")}</a></p></article><article class="panel setup-step">${icon("laptop")}<h3>Open the desktop studio</h3><p>Download the source. With Node.js 20 or newer installed, run <code>npm ci</code>, then <code>npm start</code>. See the README for supported systems.</p></article><article class="panel setup-step">${icon("eye")}<h3>Calibrate to your face</h3><p>Enter your key, allow the camera, then capture relaxed, raised and furrowed positions. Your key and calibration stay in memory.</p></article></div><article class="panel setup-card"><h2>${desktopAvailable() ? "Your desktop runtime is ready." : "Start exploring while you set up."}</h2><p>${desktopAvailable() ? "Connect with your own key, then calibrate to your movements." : "You can use the camera mirror and illustrated feedback now. Live measurements require the desktop runtime and your key."}</p>${desktopAvailable() ? btn("choose-mode", "Connect Presage", "signal", "btn-primary") : '<a class="btn btn-primary" href="./downloads/inflect-source.zip" download>Download desktop source</a>'}${btn("preview", "Explore the walkthrough", "play")}<p class="field-help">Source package \xB7 Node.js setup required \xB7 Not a signed desktop installer.</p></article>`;
}
function modal(title, body, purpose = "") {
  if (s.clock.running && purpose !== "calibration") pause();
  if (s.guide) { s.guide = false; voice.stop(); update(); }
  const el = $("#modal");
  if (!el.open) modalFocus = document.activeElement;
  modalPurpose = purpose;
  el.innerHTML = `<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon("close")}</button></div><div class="modal-body">${body}</div>`;
  if (!el.open) el.showModal();
}
function closeModal() {
  voice.stop();
  const purpose = modalPurpose;
  modalPurpose = "";
  $("#modal").close();
  if (purpose === "calibration" || connecting) {
    cancelCapture();
    if (!s.cal?.ok || connecting) stopCamera();
  }
  modalFocus?.focus?.();
}
function chooseMode() {
  modal("Make yourself comfortable.", `<p>Choose how you\u2019d like to practise. Your camera starts only after permission.</p><div class="mode-options">${desktopAvailable() ? `<button class="mode-option" data-action="live-consent">${icon("signal")}<span><strong>Live movement feedback</strong><small>Connect Presage with your key and calibrate your brow movements.</small></span>${icon("chevron")}</button>` : ""}<button class="mode-option" data-action="mirror-consent">${icon("camera")}<span><strong>Camera mirror</strong><small>See yourself beside the guide. Follow the timer and observe your own movements.</small></span>${icon("chevron")}</button><button class="mode-option" data-action="preview">${icon("play")}<span><strong>Illustrated walkthrough</strong><small>Explore a session with clearly labelled sample data. No camera needed.</small></span>${icon("chevron")}</button></div>${!desktopAvailable() ? '<p class="modal-note">For live Presage feedback, open the desktop studio. <button class="quiet-button" data-action="setup-modal">See desktop setup</button></p>' : ""}`);
}
function consent(live) {
  modal(live ? "Connect your live studio." : "Your camera is a mirror.", `<p>${live ? "Presage measures facial landmarks in the desktop app. After calibration, Inflect compares movement with the drill\u2019s prompts." : "Your camera preview stays on this device. Mirror practice does not provide automatic movement feedback."}</p>${live ? '<label class="field-label" for="api-key">Presage API key</label><input class="text-input" id="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="Enter your private API key"><p class="field-help">Kept in memory for this app session. Not saved to history or exports. Presage connects to authenticate; SDK telemetry is disabled.</p>' : ""}<label class="check-line"><input id="camera-consent" type="checkbox"><span>I am 18 or older and agree to use my camera for this practice. No video is recorded.</span></label><div id="consent-error"></div><div class="modal-actions">${btn("close-modal", "Not now")}${btn(live ? "start-live" : "start-mirror", live ? "Connect & calibrate" : "Allow camera", "camera", "btn-primary")}</div><p class="modal-note">You can stop the camera at any time.</p>`, "consent");
}
function how() {
  modal("One cue. A closer look.", `<p>Choose a movement, watch the original brow guide, then follow the short timed prompt.</p><ol class="modal-list"><li><strong>Watch.</strong> Notice the change between relaxed, raised and furrowed brows.</li><li><strong>Practise.</strong> Use a camera mirror, or calibrated live feedback in the desktop app.</li><li><strong>Review.</strong> Look at the prompted windows and try again.</li></ol><div class="modal-callout">These drills practise one part of movement. They do not recognize signed words or assess full ASL. Context is sourced; educator review is pending.</div><p class="modal-note">The illustrated walkthrough uses example data and never appears as a real practice session.</p>`);
}
function privacy() {
  modal("Your face is not a file.", `<p>Inflect does not record camera video or upload it to an app server.</p><ul class="modal-list"><li><strong>Camera:</strong> starts after consent. Stop camera, leaving the practice screen, hiding the page, or closing the app releases capture.</li><li><strong>Live processing:</strong> uses Presage\u2019s native SDK. Network authentication is required. SDK telemetry is disabled.</li><li><strong>Key and calibration:</strong> remain in memory. Inflect does not save them.</li><li><strong>History:</strong> stores only completed-session summaries on this device. Export and deletion controls are provided.</li><li><strong>Walkthrough:</strong> uses illustrated data and is excluded from history.</li><li><strong>Voice:</strong> stores only your voice preferences locally. Browser or system voices may send fixed practice instructions to their speech provider. No face data or private keys are passed to speech synthesis.</li></ul><a class="source-link" href="https://smartspectra.presagetech.com/docs/telemetry-and-privacy/" target="_blank" rel="noopener noreferrer">Presage SDK privacy documentation ${icon("external")}</a>`);
}
function cancelCapture() {
  if (s.capture?.timer !== undefined) clearTimeout(s.capture.timer);
  s.capture = null;
}
function cameraActive() { return s.nativeCamera || Boolean(s.stream); }
function liveCameraActive() {
  return s.mode === "live" && Boolean(s.source) &&
    (s.nativeCamera || Boolean(s.stream?.getVideoTracks().some(track => track.readyState !== "ended")));
}
function interruptCamera(message) {
  generation++;
  s.banner = message;
  const stopped = stopCamera();
  toast(message);
  return stopped;
}
function finishCalibrationCapture(capture) {
  if (s.capture !== capture || modalPurpose !== "calibration") return;
  cancelCapture();
  if (!liveCameraActive()) {
    interruptCamera("Your camera or live feedback stopped. Reconnect to calibrate again.");
    return;
  }
  if (s.validationCode === 11) {
    calibration(s.hint || "The camera feed is too slow. Close busy apps and improve front lighting before retrying.");
    return;
  }
  if (capture.features.length < 20) {
    calibration(s.gate.fresh() ?
      "Not enough clear samples. Keep your face visible and try this position again." :
      "Live tracking is unavailable. Check the camera preview, or reconnect live feedback.");
    return;
  }
  s.calSamples[capture.key] = capture.features;
  if (s.calStep < 2) {
    s.calStep++;
    calibration();
    return;
  }
  const cal = buildCalibration(s.calSamples);
  if (cal.ok) {
    s.cal = cal;
    s.observed = { valid: false };
    modalPurpose = "";
    $("#modal").close();
    s.banner = "";
    update();
    toast("Calibration ready. Begin when you’re comfortable.");
  } else {
    s.calStep = 0;
    s.calSamples = { neutral: [], raised: [], furrowed: [] };
    calibration(cal.reason);
  }
}
function cameraSettingText(settings = s.cameraSettings) {
  if (!settings) return "Not connected";
  const size = Number.isFinite(settings.width) && Number.isFinite(settings.height) ?
    `${settings.width}×${settings.height}` : "Resolution not reported";
  const rate = Number.isFinite(settings.frameRate) ?
    `${Number(settings.frameRate.toFixed(1))} fps ${settings.requested ? "requested" : "configured"}` : "Frame rate not reported";
  return size + " · " + rate;
}
function calibration(error = "") {
  const key = ["neutral", "raised", "furrowed"][s.calStep], copy = { neutral: ["Let your brows rest.", "Look straight at the camera with your head comfortably level. Keep a relaxed brow position."], raised: ["Gently raise your brows.", "Make a comfortable brow lift and hold it. Keep your head in the same position."], furrowed: ["Bring your brows inward.", "Gently bring your brows inward and down. Keep your head in the same position."] }[key];
  modal(copy[0], `<p>${copy[1]}</p><div class="calibration-steps">${["neutral", "raised", "furrowed"].map((k, i) => `<span class="${i === s.calStep ? "current" : ""}">${i < s.calStep ? "\u2713 " : ""}${k === "neutral" ? "Relaxed" : k === "raised" ? "Raised" : "Furrowed"}</span>`).join("")}</div><div class="calibration-previews"><div class="calibration-visual">${faceIllustration("cal-face")}</div>${s.nativeCamera ? '<div class="calibration-live-view"><canvas id="cal-tracking" width="640" height="480" aria-label="Your live face landmarks, mirrored"></canvas><span id="cal-tracking-label">Waiting for clear tracking…</span></div>' : ""}</div><div class="calibration-status" id="cal-status">We\u2019ll collect about three seconds of clear movement.</div><div class="calibration-progress"><div id="cal-progress"></div></div><p class="field-help">Keep Inflect visible while calibrating. Hiding it stops the camera.</p>${error ? `<p class="modal-error">${esc(error)}</p>` : ""}<div class="modal-actions">${btn("cancel-calibration", "Use mirror instead")}${btn("capture", "Capture this position", "camera", "btn-primary", 'id="capture-button"')}</div>`, "calibration");
  setFaceState($("#cal-face"), key);
  voice.speak(copy[0] + " Hold comfortably when you capture.", {id: "calibration:" + key, force: true});
}
function cameraError(e) {
  return e?.name === "OverconstrainedError" ? "The camera could not provide the requested feed: 640×480 at 25–30 fps. Close other camera apps and check the camera settings, or use camera mirror." : e?.name === "NotAllowedError" ? "Camera permission was declined. Allow it in browser or system settings, then try again." : e?.name === "NotFoundError" ? "No camera was found. Connect one, or explore the illustrated walkthrough." : e?.name === "NotReadableError" ? "The camera may be in use by another app. Close that app and try again." : e?.message || "The camera could not start. Check its permissions.";
}
async function startCamera(live) {
  if (!$("#camera-consent")?.checked) {
    $("#consent-error").innerHTML = '<p class="modal-error">Please confirm camera consent to continue.</p>';
    return;
  }
  const key = live ? $("#api-key")?.value.trim() : "";
  if (live && !key) {
    $("#consent-error").innerHTML = '<p class="modal-error">Enter the API key from your developer portal.</p>';
    return;
  }
  if (!live && !navigator.mediaDevices?.getUserMedia) {
    $("#consent-error").innerHTML = '<p class="modal-error">Camera access is unavailable here. Use a supported browser over HTTPS, or the illustrated walkthrough.</p>';
    return;
  }
  const mine = ++generation;
  connecting = mine;
  $("#modal").querySelectorAll("button").forEach((b) => b.disabled = true);
  try {
    await stopCamera(false);
    if (mine !== generation || document.hidden) return;
    s.mode = live ? "live" : "mirror";
    s.status = "starting";
    s.samples = 0;
    s.validationCode = 0;
    s.hint = "Preparing live tracking.";
    s.gate.reset();
    s.trace = [];
    s.report = null;
    s.banner = "";
    let fault = null;
    if (live) {
      s.source = new PresageSource({ onStream: (stream) => {
        if (mine !== generation) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        s.stream = stream;
      }, onCameraActive: active => {
        if (mine === generation) s.nativeCamera = active;
      }, onCameraSettings: settings => {
        if (mine === generation) s.cameraSettings = settings;
      }, onSample: frame => {
        if (mine === generation) handleSample(frame);
      }, onStatus: (hint, details = {}) => {
        if (mine !== generation) return;
        s.hint = hint;
        if (Number.isInteger(details.validationCode)) s.validationCode = details.validationCode;
        if (modalPurpose === "calibration" && !s.capture) {
          const status = $("#cal-status");
          const text = hint || "Tracking is ready. Capture this position when comfortable.";
          if (status && status.textContent !== text) status.textContent = text;
        }
      }, onError: (message, details = {}) => {
        if (mine !== generation) return;
        fault = details.code === 14 ? message + " Close unused apps or video tabs and use brighter front lighting before reconnecting." : message;
        console.error("Presage connection stopped:", details.code ?? details.status ?? "unknown");
        if (s.status !== "starting") interruptCamera(fault);
      } });
      await s.source.start(key);
      if (fault) throw Error(fault);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (mine !== generation || document.hidden) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      s.stream = stream;
    }
    if (mine !== generation) return;
    if (document.hidden) {
      await stopCamera();
      return;
    }
    modalPurpose = "";
    $("#modal").close();
    s.page = "practice";
    s.status = "ready";
    render();
    if (live) {
      s.calStep = 0;
      s.calSamples = { neutral: [], raised: [], furrowed: [] };
      calibration();
    } else toast("Camera mirror ready. Automatic feedback is off.");
  } catch (e) {
    if (mine !== generation) return;
    await stopCamera(false);
    if (mine !== generation || document.hidden) return;
    s.status = "idle";
    consent(live);
    $("#consent-error").innerHTML = `<p class="modal-error">${esc(cameraError(e))}</p>`;
  } finally {
    if (connecting === mine) connecting = 0;
  }
}
async function stopCamera(paint = true) {
  voice.stop();
  const source = s.source, stream = s.stream;
  s.source = null;
  s.stream = null;
  s.nativeCamera = false;
  s.cameraSettings = null;
  s.validationCode = 0;
  cancelCapture();
  if (modalPurpose === "calibration") {
    modalPurpose = "";
    $("#modal").close();
  }
  s.cal = null;
  s.calStep = 0;
  s.calSamples = { neutral: [], raised: [], furrowed: [] };
  s.observed = { valid: false };
  s.gate.reset();
  if (s.clock.running) {
    s.clock.pause(performance.now());
    s.status = "paused";
  } else if (s.mode !== "preview") s.status = "idle";
  if (s.mode !== "preview") s.mode = "idle";
  // Calling source.stop first disarms the SDK frame pump before track release.
  const stopped = source ? source.stop() : Promise.resolve();
  stream?.getTracks().forEach(track => track.stop());
  cameraStopping = Promise.allSettled([cameraStopping, stopped]).then(() => {});
  if (paint) render();
  await cameraStopping;
}
function attach() {
  const video = $("#camera-video");
  if (video && s.stream) {
    video.srcObject = s.stream;
    video.play().catch(() => toast("Click the preview to resume your camera."));
    const stream = s.stream;
    for (const t of stream.getVideoTracks()) t.onended = () => {
      if (s.stream === stream) interruptCamera("Your camera stopped. Reconnect when you’re ready.");
    };
  }
}
function handleSample(frame) {
  s.samples++;
  const result = s.gate.ingest(frame);
  if (frame.reset) {
    s.cal = null;
    s.calSamples = { neutral: [], raised: [], furrowed: [] };
    cancelCapture();
    s.calStep = 0;
    s.banner = "Tracking reset. Please calibrate again.";
    if (modalPurpose === "calibration") calibration("Tracking restarted. Capture the relaxed position again.");
  }
  if (s.validationCode === 11) {
    s.observed = { valid: false, reason: s.hint || "Camera frame rate too low" };
    return;
  }
  if (!result.valid) {
    s.observed = result;
    return;
  }
  if (s.capture) s.capture.features.push(result.features);
  s.observed = classifyBrow(result.features, s.cal);
  if (s.nativeCamera) {
    drawLandmarks($("#camera-overlay"), result.points);
    drawLandmarks($("#cal-tracking"), result.points);
    for (const id of ["#landmark-status", "#cal-tracking-label"]) {
      const label = $(id);
      if (label) label.textContent = "Live tracking · " + s.samples + " samples";
    }
    return;
  }
  const canvas = $("#camera-overlay"), video = $("#camera-video");
  if (canvas && video?.videoWidth) {
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#93b5ff";
    ctx.lineWidth = 2.5;
    for (const ids of [FACE_POINTS.rightBrow, FACE_POINTS.leftBrow]) {
      ctx.beginPath();
      ids.forEach((i, n) => {
        const p = result.points[i];
        n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
    }
  }
}
async function preview() {
  modalPurpose = "";
  if ($("#modal").open) $("#modal").close();
  await stopCamera(false);
  s.page = "practice";
  s.mode = "preview";
  s.status = "ready";
  s.trace = [];
  s.report = null;
  s.banner = "";
  s.guide = false;
  render();
  begin();
  toast("Illustrated walkthrough. Example data, no camera measurement.");
}
function begin() {
  if (!["live", "mirror", "preview"].includes(s.mode)) {
    chooseMode();
    return;
  }
  if (s.mode === "live" && !s.cal?.ok) {
    calibration();
    return;
  }
  if (s.mode === "live" && (!s.gate.fresh() || !s.observed.valid)) {
    toast("Wait for a clear, stable face measurement.");
    return;
  }
  voice.activate();
  voice.stop();
  s.trace = [];
  s.report = null;
  s.attempt = null;
  s.banner = "";
  s.status = "running";
  s.guide = false;
  s.clock = new PracticeClock();
  s.clock.start(performance.now());
  $("#results-container").innerHTML = "";
  update();
  updateCue(0);
  $('.practice-stage')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function pause(reason = "") {
  voice.stop();
  s.clock.pause(performance.now());
  s.status = "paused";
  s.banner = reason;
  update();
}
function finish() {
  s.clock.pause(performance.now());
  s.status = "complete";
  s.report = s.mode === "mirror" ? [] : summarizeAttempt(s.lessonId, s.trace);
  s.attempt = { id: crypto.randomUUID(), date: (/* @__PURE__ */ new Date()).toISOString(), lessonId: s.lessonId, mode: s.mode, duration: 20, report: s.report };
  if (s.mode !== "preview") s.saveFailed = !saveAttempt(s.attempt);
  $("#results-container").innerHTML = results();
  update();
  voice.speak(practiceGuidance(s.lessonId, 20).speech, {id: "complete", force: true});
  requestAnimationFrame(focusReview);
  toast(s.mode === "preview" ? "Example complete. No practice session was saved." : "Session complete. Take a closer look.");
}
function update() {
  if (s.page !== "practice") return;
  $("#mode-tag").textContent = modeName();
  $("#mode-tag").classList.toggle("live", s.mode === "live");
  $("#camera-state").innerHTML = `${icon(cameraActive() ? "camera" : s.mode === "preview" ? "eye" : "cameraOff")}${cameraActive() ? "Camera on" : s.mode === "preview" ? "Camera not used" : "Camera off"}`;
  $("#camera-state").classList.toggle("live", cameraActive());
  $("#camera-zone").classList.toggle("has-stream", cameraActive());
  $("#camera-zone").classList.toggle("is-preview", s.mode === "preview");
  $(".practice-stage").dataset.state = s.status;
  $("#control-buttons").innerHTML = s.status === "running" ? btn("pause", "Pause", "pause") + btn("end", "End session", "stop") : s.status === "paused" && s.mode !== "idle" ? btn("end", "End session", "stop") + btn("resume", "Resume", "play", "btn-primary") : s.status === "complete" ? btn("review", "Review session", "eye", "btn-secondary") : s.mode === "idle" ? "" : btn("begin", s.mode === "live" && !s.cal?.ok ? "Calibrate your face" : "Begin 20-second practice", "play", "btn-primary");
  $("#controls-status").textContent = s.mode === "preview" ? "Illustrated data \xB7 Not a live measurement or saved session." : s.status === "running" ? "Follow the prompt. Keep the movement comfortable." : s.status === "paused" ? "Practice paused. Take your time." : s.status === "complete" ? "Drill complete. Review, then try again." : s.mode === "live" ? "Personal calibration \xB7 Movement feedback, not an ASL grade." : s.mode === "mirror" ? "Mirror practice \xB7 No automatic movement assessment." : "Watch the guide, then try the movement with your camera.";
  $("#timeline-description").textContent = s.mode === "preview" ? "An illustrated example of movement against the prompts." : s.mode === "mirror" ? "Follow the prompt windows; observe your own movement." : "The shaded windows show when to follow the cue.";
  $("#quality-banner").hidden = !s.banner;
  $("#quality-banner").innerHTML = `${icon("info")}<span>${esc(s.banner)}</span>${s.mode === "live" && !s.cal?.ok ? btn("recalibrate", "Calibrate") : s.mode === "idle" ? btn("live-consent", "Reconnect live feedback") : ""}`;
  $("#watch-button").innerHTML = `${icon(s.guide ? "pause" : "play")}${s.guide ? "Pause guide" : "Watch guide"}`;
  $("#watch-button").setAttribute("aria-pressed", String(s.guide));
  $("#watch-button").disabled = s.clock.running || s.status === "paused";
  $("#watch-button").title = s.clock.running || s.status === "paused" ? "The guide follows your practice timer." : "Watch a complete movement cycle.";
  $("#diag-source").textContent = s.mode === "live" ? "Presage SmartSpectra 3.5.0" : s.mode === "preview" ? "Illustrated example data" : s.mode === "mirror" ? "Camera only \xB7 no measurements" : "Not connected";
  $("#diag-calibration").textContent = s.cal?.ok ? "Personal \xB7 in memory" : "Not calibrated";
  $("#diag-camera").textContent = cameraSettingText();
  updateGuidance();
}
function chart(t = 0) {
  const el = $("#timeline");
  if (!el) return;
  let path = "", pen = false, last = null;
  for (const p of s.trace) {
    if (!p.valid || !Number.isFinite(p.value)) {
      pen = false;
      continue;
    }
    if (last !== null && p.t - last > 0.35) pen = false;
    path += `${pen ? "L" : "M"}${(p.t * 50).toFixed(1)},${(51 - p.value * 15).toFixed(1)} `;
    pen = true;
    last = p.t;
  }
  const obs = s.trace.at(-1);
  el.innerHTML = `${[0, 5, 10, 15, 20].map((v) => `<path d="M${v * 50} 0v64" stroke="#e9edf6" stroke-dasharray="3 5"/>`).join("")}<path d="M0 51H1000" stroke="#e6ebf5"/>${WINDOWS[s.lessonId].map((w) => `<rect x="${w.start * 50}" y="1" width="${(w.end - w.start) * 50}" height="17" rx="3" fill="${w.target === "raised" ? "#e3eafa" : "#eae5f4"}"/><text x="${(w.start + w.end) * 25}" y="13" text-anchor="middle" fill="#7589b9" font-size="11" font-family="DM Sans,sans-serif">${w.target === "raised" ? "RAISE" : "FURROW"}</text>`).join("")}${path ? `<path d="${path}" stroke="#5876d5" fill="none" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` : '<text x="500" y="48" text-anchor="middle" fill="#8798b4" font-size="12" font-family="DM Sans,sans-serif">Your session will appear here</text>'}${t > 0 ? `<path d="M${t * 50} 0v65" stroke="#9daee0"/>${obs?.valid ? `<circle cx="${t * 50}" cy="${51 - obs.value * 15}" r="3" fill="#6782d9"/>` : ""}` : ""}${[0, 5, 10, 15, 20].map((v) => `<text x="${v === 0 ? 1 : v === 20 ? 999 : v * 50}" y="82" text-anchor="${v === 0 ? "start" : v === 20 ? "end" : "middle"}" fill="#8191ad" font-size="11" font-family="DM Sans,sans-serif">${v}s</text>`).join("")}`;
  el.setAttribute("aria-label", `Twenty-second ${s.mode === "preview" ? "illustrated example" : "practice"} timeline, ${t.toFixed(0)} seconds elapsed. Prompt windows: 3 to 7 and 10 to 14 seconds.`);
}
function updateCue(t) {
  const g = practiceGuidance(s.lessonId, t);
  setFaceState($('#guide-face'), g.target);
  for (const id of ['#guide-cue', '#camera-cue-text']) {
    const el = $(id);
    if (el && el.dataset.cue !== g.title) { el.textContent = g.title; el.dataset.cue = g.title; }
  }
  updateGuidance(g);
  if (g.id !== 'complete') speakCurrentCue();
}
function tick(now) {
  requestAnimationFrame(tick);
  if (now - s.paint < 65) return;
  s.paint = now;
  if (s.capture && s.validationCode === 11) {
    cancelCapture();
    calibration(s.hint || "The camera feed is too slow. Improve front lighting and reduce other device activity.");
  }
  if (s.capture) {
    const c = s.capture, elapsed = now - c.start;
    const progress = $("#cal-progress"), status = $("#cal-status");
    if (progress) progress.style.width = Math.min(100, elapsed / 32) + "%";
    if (status) status.textContent = s.gate.fresh(now) ?
      `Hold comfortably… ${Math.max(0, Math.ceil((3200 - elapsed) / 1e3))}` :
      "Waiting for clear tracking. Keep your face visible.";
    if (elapsed >= 3200) finishCalibrationCapture(c);
  }
  if (s.page !== "practice") return;
  if (s.mode === "live") {
    const fresh = s.gate.fresh(now);
    $("#diag-samples").textContent = s.samples;
    $("#diag-tracking").textContent = fresh ? s.observed.valid ? s.observed.state : "Visible \xB7 between calibrated positions" : "Unavailable";
    if (!fresh) {
      for (const id of ["#camera-overlay", "#cal-tracking"]) {
        const canvas = $(id);
        if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      }
      for (const id of ["#landmark-status", "#cal-tracking-label"]) {
        const label = $(id);
        if (label) label.textContent = s.hint || "Waiting for clear tracking…";
      }
    }
    if (s.clock.running && s.validationCode === 11) pause(s.hint || "Camera frame rate too low. Improve lighting and close busy apps.");
    if (s.clock.running && (!fresh || !s.cal?.ok)) pause(s.cal?.ok ? "Tracking paused. Keep your face visible; resume when ready. Missing measurements are not graded." : "Tracking reset. Please calibrate again.");
  }
  if (s.clock.running) {
    const t = s.clock.time(now);
    updateCue(t);
    $("#timer-value").textContent = "00:" + String(Math.floor(t)).padStart(2, "0");
    if (s.mode === "preview") {
      s.trace = fillPreviewTrace(s.lessonId, s.trace, t);
      setFaceState($("#learner-face"), samplePreview(s.lessonId, t).state);
    } else if (s.mode === "live") s.trace.push({ t, state: s.observed.state || "unavailable", value: s.observed.valid ? s.observed.value : null, valid: s.observed.valid && s.gate.fresh(now), source: "presage" });
    chart(t);
    if (s.clock.done(now)) finish();
  } else if (s.guide) {
    const elapsed = (now - s.guideStart) / 1000;
    if (elapsed >= 20) {
      s.guide = false;
      s.watched = true;
      voice.stop();
      update();
      setFaceState($('#guide-face'), 'neutral');
      toast('That’s the movement. Try it with your camera when you’re ready.');
    } else updateCue(elapsed);
  }
}
function exportJson(data) {
  const blob = new Blob([JSON.stringify({ app: "Inflect", version: "0.1.3", scope: "Brow movement in a prompted drill; not ASL proficiency", ...data }, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = `inflect-session-${data.date?.slice(0, 10) || "practice"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
async function navigate(page) {
  if (!["practice", "history", "resources", "setup"].includes(page)) return;
  s.focus = false;
  s.watched = false;
  s.clock.pause(performance.now());
  s.guide = false;
  await stopCamera(false);
  s.mode = "idle";
  s.status = "idle";
  s.page = page;
  s.report = null;
  s.trace = [];
  s.banner = "";
  render();
  $("#main").focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
async function selectLesson(id) {
  if (!LESSONS.some((l) => l.id === id)) return;
  s.focus = false;
  s.watched = false;
  s.clock.pause(performance.now());
  s.guide = false;
  await stopCamera(false);
  s.lessonId = id;
  s.mode = "idle";
  s.status = "idle";
  s.report = null;
  s.trace = [];
  s.banner = "";
  render();
  $("#tab-" + id)?.focus({ preventScroll: true });
}
async function action(name, target) {
  switch (name) {
    case 'focus':
      s.focus = !s.focus;
      $('.workspace').classList.toggle('focus-view', s.focus);
      $('#focus-button').setAttribute('aria-pressed', String(s.focus));
      $('#focus-button span').textContent = s.focus ? 'Exit focus' : 'Focus view';
      break;
    case "toggle-voice":
      voice.activate();
      {
        const turnOn = !voice.settings.enabled || voice.settings.volume === 0 || !!voice.failed;
        if (turnOn && voice.settings.volume === 0) voice.setVolume(0.8);
        voice.setEnabled(turnOn);
      }
      if (voice.settings.enabled) {
        if (s.clock.running || s.guide) speakCurrentCue(true);
        else voice.speak("Voice guidance is on.", {id: "voice-enabled", force: true});
      }
      break;
    case "voice-settings": voiceSettings(); break;
    case "test-voice":
      if (!voice.retry()) toast(voice.settings.volume === 0 ? "Turn up voice volume to hear the sample." : "Voice is unavailable here. Written cues stay available.");
      break;
    case "review": focusReview(); break;
    case "nav":
      await navigate(target.dataset.page);
      break;
    case "lesson":
      await selectLesson(target.dataset.lesson);
      break;
    case "choose-mode":
      chooseMode();
      break;
    case "mirror-consent":
      consent(false);
      break;
    case "live-consent":
      consent(true);
      break;
    case "start-mirror":
      await startCamera(false);
      break;
    case "start-live":
      voice.activate();
      await startCamera(true);
      break;
    case "preview":
      voice.activate();
      await preview();
      break;
    case "how":
      how();
      break;
    case "privacy":
      privacy();
      break;
    case "setup-modal":
      modalPurpose = "";
      $("#modal").close();
      await navigate("setup");
      break;
    case "close-modal":
      generation++;
      closeModal();
      break;
    case "watch":
      voice.activate();
      voice.stop();
      s.guide = !s.guide;
      if (s.guide) s.watched = false;
      s.guideStart = performance.now();
      update();
      if (s.guide) updateCue(0);
      break;
    case "camera":
      if (cameraActive()) {
        generation++;
        await stopCamera();
        toast("Camera stopped.");
      } else chooseMode();
      break;
    case "begin":
    case "retry":
      begin();
      break;
    case "pause":
      pause();
      break;
    case "resume":
      if (s.mode === "live" && (!s.gate.fresh() || !s.cal?.ok)) {
        toast("Clear tracking and calibration are needed before resuming.");
        break;
      }
      s.banner = "";
      s.clock.resume(performance.now());
      s.status = "running";
      voice.activate();
      voice.stop();
      update();
      updateCue(s.clock.time(performance.now()));
      break;
    case "end":
      voice.stop();
      s.clock.pause(performance.now());
      s.status = "ready";
      s.trace = [];
      s.report = null;
      s.banner = "";
      render();
      toast("Incomplete sessions are not saved.");
      break;
    case "next":
      await selectLesson(LESSONS[(LESSONS.findIndex((l) => l.id === s.lessonId) + 1) % 3].id);
      break;
    case "recalibrate":
      s.calStep = 0;
      s.calSamples = { neutral: [], raised: [], furrowed: [] };
      calibration();
      break;
    case "capture": {
      if (modalPurpose !== "calibration" || s.capture) break;
      if (!liveCameraActive()) {
        await interruptCamera("Your camera or live feedback stopped. Reconnect to calibrate again.");
        break;
      }
      if (s.validationCode === 11) {
        $("#cal-status").textContent = s.hint || "The camera feed is too slow. Improve front lighting and close busy apps.";
        break;
      }
      if (!s.gate.fresh()) {
        $("#cal-status").textContent = s.hint || "Waiting for clear live tracking. Keep your face visible before capturing.";
        break;
      }
      voice.speak("Hold comfortably.", {id: "capture", force: true});
      const capture = { key: ["neutral", "raised", "furrowed"][s.calStep], start: performance.now(), features: [] };
      s.capture = capture;
      // Complete independently of animation frames; cancelled timers cannot advance a later session.
      capture.timer = setTimeout(() => finishCalibrationCapture(capture), 3200);
      target.disabled = true;
      break;
    }
    case "cancel-calibration":
      cancelCapture();
      modalPurpose = "";
      $("#modal").close();
      generation++;
      await stopCamera(false);
      s.status = "idle";
      render();
      consent(false);
      break;
    case "export":
      if (s.attempt && s.attempt.mode !== "preview") exportJson(s.attempt);
      break;
    case "export-history": {
      const h = readHistory().find((h2) => h2.id === target.dataset.id);
      if (h) exportJson(h);
      break;
    }
    case "clear":
      modal("Clear your practice history?", `<p>This removes the summaries saved on this device. No camera recordings are stored.</p><div class="modal-actions">${btn("close-modal", "Keep my history")}${btn("confirm-clear", "Clear history", "trash", "btn-danger")}</div>`);
      break;
    case "confirm-clear":
      if (clearHistory()) {
        closeModal();
        render();
        toast("Practice history cleared.");
      } else toast("This browser could not clear storage. Check its site-data settings.");
      break;
  }
}
document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  if (!target || target.disabled) return;
  e.preventDefault();
  action(target.dataset.action, target).catch((error) => {
    console.error("Inflect action failed:", error.name);
    toast("That action could not finish. Please try again.");
  });
});
$("#modal").addEventListener("cancel", (e) => {
  e.preventDefault();
  generation++;
  closeModal();
});
$("#modal").addEventListener("click", (e) => {
  if (e.target !== $("#modal")) return;
  const r = e.target.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
    generation++;
    closeModal();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    voice.stop();
    generation++;
    s.guide = false;
    if (s.clock.running) pause("Practice paused while the page was hidden.");
    if (s.stream || s.source || connecting) {
      cancelCapture();
      modalPurpose = "";
      if ($("#modal").open) $("#modal").close();
      stopCamera();
    }
  }
});
window.addEventListener("pagehide", () => {
  voice.stop();
  generation++;
  stopCamera(false);
});
document.addEventListener("keydown", (e) => {
  if ($("#modal").open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (s.page === "practice" && !e.target.closest('button,a')) {
    if (e.key === 'Escape' && s.clock.running) { e.preventDefault(); pause(); return; }
    if (e.code === 'Space' && (s.clock.running || s.status === 'paused')) { e.preventDefault(); if (s.clock.running) pause(); else action('resume', {}); return; }
  }
  const tab = e.target.closest('[role="tab"]');
  if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
    e.preventDefault();
    const n = LESSONS.findIndex((l) => l.id === tab.dataset.lesson), i = e.key === "Home" ? 0 : e.key === "End" ? 2 : (n + (e.key === "ArrowRight" ? 1 : 2)) % 3;
    selectLesson(LESSONS[i].id);
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'voice-volume' || e.target.id === 'voice-modal-volume') voice.setVolume(Number(e.target.value) / 100);
});
document.addEventListener('change', e => {
  if (e.target.id === 'guide-voice') voice.setVoice(e.target.value);
  if (e.target.id === 'voice-rate') voice.setRate(Number(e.target.value));
});
render();
requestAnimationFrame(tick);
