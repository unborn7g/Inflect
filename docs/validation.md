# Validation status — 0.1.3

Updated 23 November 2026. The final sweep used a clean copy of public commit `72a20ce`, with the existing installed dependencies. Implementation checks and live evidence are recorded separately.

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
| Live calibration and a full drill in desktop 0.1.3 | Continuous 68-second recording of calibration, a complete live 20-second drill and its review; see [23 November recording](live-run-2026-11-23.md) |
| Public browser walkthrough and navigation | Passed: complete illustrated drill and labelled review; Practice, My sessions, Field notes and Desktop setup |
| Public desktop and mobile layout | Passed at approximately 1444 px and 390 px viewport widths; no horizontal overflow |
| Public video playback | Both H.264 videos played: 67.93-second live clip and 147.47-second narrated walkthrough, both 1920×1080 |
| Downloadable source and deployed code | All 34 compared runtime and test source files match the public repository; deployed app.js, styles.css and SDK renderer bundle match a fresh build |
| Published challenge entry | Published before the deadline, visible in the challenge tag feed, with one entry under the builder’s account; cover and all submission links reachable |
| Sustained native performance across longer runs and hardware | Pending |
| Learner testing, ASL feedback accuracy and educator review | Pending |

## What the live transcript establishes

The second direct-camera run accepted the locally entered key, reached running, and delivered fresh stable landmarks through the end of its short diagnostic. Its camera path was SDK-owned 640×480 capture requested at 30 fps. Earlier attempts included a 401 authentication failure and an Electron renderer low-frame-rate stop.

The successful transcript establishes a short native landmark run on this webcam. It does not establish full desktop calibration, sustained frame rate, classification accuracy, signing proficiency or learning outcomes. A shutdown usage-drain warning followed the successful result; the SDK said that undelivered batch was not billed.

## Recorded desktop live workflow — 23 November

The continuous recording shows the native live landmark view, personal calibration, a complete 20-second drill and the actual review. Across the two four-second cues, the app reported 2.3 s and 3.0 s of matching movement, with 3.9 s and 4.0 s of usable tracking. These are rounded app observations, not validated gesture accuracy or learning outcomes. See [recording details and limits](live-run-2026-11-23.md).

## Earlier desktop live workflow — 22 November

The builder supplied a live landmark view, a completed 20-second review and an exported session marked live. The two cues had 2.6514 and 1.4637 seconds of usable observations. Matching movement occupied 0.8677 and 0.5331 seconds. These are app observations with tracking gaps; they do not establish classifier accuracy or learning outcomes. The original export used an outdated 0.1.2 header label, now corrected in the app to 0.1.3.

See live-run-2026-11-22.md for the evidence and its limits.

## Desktop integration check

The separate Electron check loads the real sandboxed preload and app page, drives camera consent with a fake test key, and supplies a synthetic native runtime. It completes relaxed, raised and furrowed calibration without stopping the session, verifies the live landmark view and calibrated state, then injects an interruption and verifies camera-off recovery. It uses no real camera, authenticates no key and stores no test history in the user's normal profile.

Run npm run smoke:desktop to repeat it. This is an implementation check, not additional live-camera evidence.

The final public-browser check completed an illustrated drill and review, exercised all navigation pages, checked narrow reflow and played both public videos. Earlier checks also covered guide playback, focus view and voice fallback. Browser checks and the synthetic Electron test are separate from the builder’s recorded physical-camera session.

No claim of validated ASL accuracy, learning improvement, medical capability or educator endorsement is made.
