# Inflect

A focused practice room for adults beginning ASL alongside qualified instruction. Observe brow movement between lessons with original guides, a camera mirror and desktop Presage feedback.

[Open the browser studio](https://inflect-practice.vercel.app/) · [Watch the demo](https://inflect-practice.vercel.app/demo/) · [Published DEV submission](https://dev.to/unborn7g/title-inflect-let-your-face-ask-the-question-38pm)

Inflect pairs original movement illustrations with a camera mirror and short prompts. In the desktop app, Presage SmartSpectra supplies facial landmarks; personal calibration turns them into reviewable brow-movement observations.

## Modes

| Mode | Where | What happens |
| --- | --- | --- |
| Camera mirror | Browser or desktop | Real camera preview and timed prompts. No automatic movement assessment. Completed summaries can be saved locally. |
| Presage live | Desktop | Actual SDK landmarks, three-position personal calibration, timing feedback and review. Requires your own key and camera. |
| Illustrated walkthrough | Browser or desktop | Clearly labelled synthetic data explains the interface. No camera measurement; never saved as real practice. |

## Run the desktop studio

Requirements: Node.js 20+ (24 LTS recommended), a camera, internet access for SDK authentication, and your Presage API key. Supported SDK platforms: Windows x64, macOS Apple Silicon, and Linux x64/ARM64 with glibc 2.35+.

1. Extract the source package. Open a terminal inside the `inflect` folder.
2. Run `npm ci`.
3. Run `npm start`.
4. Choose **Practice → Use my camera → Live movement feedback**.
5. Enter your private key, confirm adult camera consent, and choose **Connect & calibrate**.
6. Capture relaxed, raised and furrowed brow positions. Then choose **Begin drill**.

Get a free key through [Presage registration](https://physiology.presagetech.com/auth/register). Verify your email, sign in, and find the key in the developer portal. There is no key in this repository or the source download. Enter it in the local desktop app; Inflect keeps it in memory only.

The source package is not a signed desktop installer. Node.js setup is required. SmartSpectra includes several native platform runtimes, so installation can be a large download.

## Direct native camera diagnostic

If live feedback stops from sustained low frame rate, close Inflect and run npm run camera:check in this folder. Paste the key once into the masked local prompt; stars and a character count confirm input, and Ctrl+U clears the entry. This 20-second check runs the SDK camera directly, without Electron video-frame copying. See [native camera check](docs/native-camera-check.md). The direct SDK diagnostic run received 101 stable landmark packets. A separate desktop practice run displayed 1,128 landmark samples, completed a live 20-second drill and exported its review; see [live-run notes](docs/live-run-2026-11-22.md).

## Native desktop capture (0.1.3)

Live mode now lets the native SDK own the camera directly, matching the successful native diagnostic. The app shows measured face landmarks and highlighted brows during calibration and practice. The separate Camera mirror mode provides the video preview.

All three calibration poses share one native session. Capture starts only with fresh usable landmarks. Keep the app visible; wait for live tracking before capturing each pose. Native settings are requested values, not measured delivered FPS. See [native desktop notes](docs/native-desktop.md).

## Earlier camera performance update (0.1.2)

Live feedback requests one 640×480 camera feed at 30 fps to reduce processing load. The camera must support at least 25 fps; its reported configuration appears in Connection details. Native frame-rate warnings stop unreliable capture and offer a manual reconnect. Use steady front lighting and close unused video/browser tabs. See [camera performance notes](docs/camera-performance.md) for validation limits.

## Calibration recovery (0.1.1)

Keep Inflect visible while capturing relaxed, raised and furrowed positions. Hiding or minimizing the app stops camera capture; reconnect after returning.

Changing calibration positions keeps the same camera and SDK session. Capture waits for fresh landmarks, and a timed capture completes independently of screen redraws. If the camera or SDK stops, the unfinished capture is cancelled and its dialog closes. The practice screen shows the interruption with **Reconnect live feedback**. A reconnect waits for the previous SDK shutdown.

See [camera repair notes](docs/camera-repair.md) for changes and validation limits.

## Browser studio

```sh
npm ci
npm run build
npm run preview
```

Open the localhost URL printed by the server. Camera access needs localhost or HTTPS and browser permission. A normal hosted browser cannot run the native SDK; use mirror practice or the illustrated walkthrough there.

## Spoken practice cues

Choose **Watch guide** or begin a drill to hear short instructions for getting ready, moving, relaxing and finishing. The voice, written cue, illustration and countdown follow the same 20-second schedule. Pause cancels speech; resume reads the current cue rather than a backlog. Opening settings pauses an active drill.

Use **Voice on/off** and the volume slider beside the practice steps. **Voice settings** lets you choose an available English device voice, speaking pace and volume, and play a sample. Preferences are saved on this device. Nothing speaks on page load. Written prompts and countdowns remain available with sound off or when speech fails.

Speech uses voices provided by the browser or operating system. Availability and quality vary by device; some voices need internet access. Only fixed practice instructions are passed to speech synthesis, never camera frames, landmarks or private keys. No additional speech API key is required.

## What the app measures

- Pinned SmartSpectra SDK 3.5.0, Electron 45.4.1 and esbuild 0.28.2.
- Uses the native SDK camera API through a restricted main/preload bridge, with sandboxing, context isolation and no Node integration in the renderer.
- Requests only `MetricType.FACE_LANDMARKS` (11). Telemetry and accumulated output are disabled.
- Decodes metrics in the main process through the official `/messages` entry point. Only landmarks and status reach the live UI; video frames stay in native capture.
- Uses Presage's documented 478-point MediaPipe topology and pixel coordinates. Eye geometry normalizes distances and compensates for small head roll.
- Personally captured centroids and sample noise determine whether relaxed, raised and furrowed movements are distinguishable. Similar calibration samples are rejected.
- Missing, unstable, reset, stale, repeated, out-of-order, malformed or ambiguous measurements are unscored. Tracking loss pauses the drill. Long gaps do not become observed time.

The detector and thresholds are engineering choices requiring real-user validation. They are not SDK-provided ASL labels or emotion classifications.

## Scope and learning content

Three original 20-second drills cover a gentle lift, a gentle furrow and changing between them. The fixed windows are movement-practice prompts, not universal ASL timing rules. Illustrations show brows only, not signed sentences. Source materials are linked; no Lifeprint images, videos, curriculum or likenesses are copied or embedded.

Each lesson now begins with a short explanation and an English example of the question context. These examples are not ASL translations or complete signing demonstrations. The practice room keeps the guide, camera, timed instructions and controls together. **Focus view** enlarges this area and hides the lesson brief; changing lessons brings the brief back. **Watch guide** plays one 20-second cycle and stops. The optional **Session timeline** expands when you want a closer look.

**ASL educator review is pending.** Inflect does not recognize hands or signed words, translate ASL, grade complete sentences, establish fluency, diagnose anything or infer feelings. It complements qualified teaching.

## Privacy

The app asks for adult camera consent and requests video only. It does not record or upload camera frames to an app server. Presage performs native processing and network authentication; review its policies separately. SDK telemetry is disabled.

Keys, raw landmarks and calibration stay in memory. Completed history contains only aggregate summaries. Export and deletion controls are included. Illustrated sessions cannot enter real history. Stopping the camera, leaving practice, hiding the page or closing the app releases capture.

Optional voice preferences (enabled, volume, pace and voice selection) are stored locally, separately from session history. Voice playback stops when practice pauses, a dialog closes, you leave practice, or the page is hidden. A device voice may use its provider's network speech service for the fixed cue text.

## Checks and evidence

```sh
npm run check
npm test
npm run smoke:sdk
npm run smoke:desktop
npm run build
```

Tests use synthetic fixtures and verify implementation properties; they do not establish accuracy on real people. All 112 automated tests, JavaScript/CSP checks and build pass. Native loading and camera discovery also pass inside Windows Electron.

The user's direct native camera run reached running and returned 101 stable landmark packets with a final timestamp age of 0 ms. That is evidence of a short native capture run. An Electron flow check with synthetic landmarks also completed all three poses in one session and recovered from a deliberate SDK interruption. Run npm run smoke:desktop to repeat that implementation check; it uses no real camera or network and an isolated temporary profile.

The builder then supplied a live desktop screenshot, a completed 20-second timing review and an exported session marked live. The two cues had partial usable tracking, which is documented in the [live-run notes](docs/live-run-2026-11-22.md). Longer hardware testing, learner evaluation and educator review remain pending. See [manual test guide](docs/manual-test-guide.md), [architecture](docs/architecture.md) and [validation status](docs/validation.md).

## Demo and submission

[Watch the live run and narrated walkthrough](https://inflect-practice.vercel.app/demo/). The page opens with a 68-second continuous desktop recording: real Presage landmarks, calibration, a complete 20-second drill and its review. The recorded review reports 3.9 s and 4.0 s of usable tracking across the two four-second cues. See [the recorded run](docs/live-run-2026-11-23.md).

The earlier 2:27 narrated presentation remains below it, with clearly labelled examples and previous live-run screenshots. See [video provenance](docs/demo-provenance.md).

The [DEV post draft](docs/dev-submission.md) includes the public code and demo links. The [published DEV submission](https://dev.to/unborn7g/title-inflect-let-your-face-ask-the-question-38pm) is the challenge entry. See [submission links and editing reference](docs/publish.md).

## Sources

- [ASL University: non-manual markers](https://www.lifeprint.com/asl101/pages-layout/nonmanualmarkers.htm)
- [ASL University: facial grammar and timing](https://www.lifeprint.com/asl101/topics/grammar17.htm)
- [ASL educator perspectives, CHI 2026](https://saadh.info/papers/hassan-chi26/hassan-chi26.pdf)
- [Presage Node/Electron API](https://smartspectra.presagetech.com/docs/nodejs/api-reference/)
- [Presage model cards and landmark numbering](https://smartspectra.presagetech.com/docs/model-cards-and-limitations/)
- [Presage data types](https://smartspectra.presagetech.com/docs/data-types/)
- [Presage privacy](https://smartspectra.presagetech.com/docs/telemetry-and-privacy/)
- [Google's MediaPipe connections](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/python/solutions/face_mesh_connections.py)

Original app art, icons, wording and drill schedules. External authors have not endorsed this app. DM Sans and Instrument Serif are bundled locally with their SIL Open Font License texts. App code is MIT; third-party component licenses apply separately.
