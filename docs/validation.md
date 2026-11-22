# Validation status — 0.1.3

Updated 22 November 2026. Implementation checks and live evidence are recorded separately.

| Check | Result |
| --- | --- |
| Automated signal, calibration, timing, privacy, voice, camera and native lifecycle checks | 112 passed |
| JavaScript syntax and CSP | Passed |
| Production build and source package | Passed |
| SmartSpectra 3.5.0 import in Node | Passed |
| SmartSpectra import and camera discovery in Windows Electron 45.4.1 | Passed; Integrated Webcam found |
| Electron native bridge and all three calibration poses | Passed using synthetic landmarks in an isolated test profile; no real camera or network used |
| Electron interruption recovery after calibration | Passed using a deliberate test error |
| Authenticated direct native camera diagnostic | User-provided transcript: running state, 101 stable landmark packets, last timestamp age 0 ms, RESULT: LIVE LANDMARKS RECEIVED |
| Live calibration and a full drill in desktop 0.1.3 | User-provided live screenshot, completed 20-second review and exported live session; see live-run-2026-11-22.md |
| Sustained native performance across longer runs and hardware | Pending |
| Learner testing, ASL feedback accuracy and educator review | Pending |

## What the live transcript establishes

The second direct-camera run accepted the locally entered key, reached running, and delivered fresh stable landmarks through the end of its short diagnostic. Its camera path was SDK-owned 640×480 capture requested at 30 fps. Earlier attempts included a 401 authentication failure and an Electron renderer low-frame-rate stop.

The successful transcript establishes a short native landmark run on this webcam. It does not establish full desktop calibration, sustained frame rate, classification accuracy, signing proficiency or learning outcomes. A shutdown usage-drain warning followed the successful result; the SDK said that undelivered batch was not billed.

## Completed desktop live workflow

The builder supplied a live landmark view, a completed 20-second review and an exported session marked live. The two cues had 2.6514 and 1.4637 seconds of usable observations. Matching movement occupied 0.8677 and 0.5331 seconds. These are app observations with tracking gaps; they do not establish classifier accuracy or learning outcomes. The original export used an outdated 0.1.2 header label, now corrected in the app to 0.1.3.

See live-run-2026-11-22.md for the evidence and its limits.

## Desktop integration check

The separate Electron check loads the real sandboxed preload and app page, drives camera consent with a fake test key, and supplies a synthetic native runtime. It completes relaxed, raised and furrowed calibration without stopping the session, verifies the live landmark view and calibrated state, then injects an interruption and verifies camera-off recovery. It uses no real camera, authenticates no key and stores no test history in the user's normal profile.

Run npm run smoke:desktop to repeat it. This is an implementation check, not additional live-camera evidence.

Earlier browser checks covered guide playback, the illustrated walkthrough, focus view, review, voice fallback and narrow reflow. They are historical checks from the browser studio, not a physical-device trial of native desktop 0.1.3.

No claim of validated ASL accuracy, learning improvement, medical capability or educator endorsement is made.
