---
title: "Inflect: Let your face ask the question"
published: false
tags: devchallenge, presagechallenge
---

<!-- DRAFT: replace REPLACE_DEMO_VIDEO_URL before publishing. -->
*This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).*

## What I Built

**Inflect is a focused desktop practice studio for the brow movements used in ASL questions.**

A learner can watch an original movement guide, calibrate three comfortable brow positions, follow a 20-second drill, and review how their observed movement lined up with two prompts.

The goal is to make a small movement easier to see and reflect on. The interface combines a movement illustration, written and optional spoken cues, a mirrored live landmark view, and a timing review.

Raised and furrowed brows are introduced with ASL context and linked learning sources. Inflect assesses brow movement during its prompts. It does not recognize signed words or assess ASL proficiency, and educator review is pending.

There are three distinct modes:

- **Presage live:** actual facial landmarks, personal calibration and movement-timing feedback in the desktop app.
- **Camera mirror:** video and timed self-review, with no automatic assessment.
- **Illustrated walkthrough:** labelled example data for exploring the interface; excluded from real session history.

Solo project by **unborn**, built with Codex assistance.

## Demo

Demo video: REPLACE_DEMO_VIDEO_URL

The video should show actual live landmarks, calibration, a complete 20-second drill and the resulting review. The desktop app uses a private key entered locally; the recording should begin after that key has been entered.

One completed live run is documented in [the live-run notes](https://github.com/unborn7g/Inflect/blob/main/docs/live-run-2026-11-22.md). It reached the review screen, generated both cue observations and exported a session marked live. This is a functional demonstration, not a validation study of feedback accuracy.

## Code

Public repository: https://github.com/unborn7g/Inflect

The README contains setup, modes, limitations, privacy and test instructions.

Requirements: Node.js 20 or newer, a supported native SDK platform, a camera, internet access for SDK services, and a valid Presage API key.

```sh
npm ci
npm start
```

Choose **Live movement feedback**, enter your own key, confirm camera consent, and wait for clear landmarks. Capture relaxed, raised and furrowed positions, then begin a drill. No app account is required. Reviewers supply their own Presage SDK key.

Checks:

```sh
npm test
npm run check
npm run smoke:sdk
npm run smoke:desktop
```

The 112 automated tests check signal gating, calibration, timing, storage, voice and camera lifecycle behavior. The Electron flow check uses synthetic landmarks and an isolated test profile.

## How It Responds to Human Signals

Inflect uses **MetricType.FACE_LANDMARKS** from **Presage SmartSpectra 3.5.0**.

In the desktop app, the native SDK owns capture directly. It requests 640×480 at 30 fps. The main process decodes the official metrics payload and forwards landmarks and guidance through a restricted bridge to the sandboxed UI. Camera input frames are not pumped through the browser renderer.

The app uses the documented 478-point topology. It normalizes brow height against eye geometry and also observes inner-brow spacing. A personal calibration captures relaxed, raised and furrowed positions; median positions and sample noise determine whether those positions can be distinguished.

During a drill, usable measurements are compared with those calibrated positions and the prompted movement. The review shows observed matching time and when matching movement first appeared after a cue began.

Timestamp age, order, stability, tracking resets and geometry are checked before scoring. Missing or ambiguous measurements remain unscored. Tracking loss pauses the drill, and an SDK interruption cancels unfinished calibration and offers a manual reconnect.

Getting capture reliable was a major part of the build. The original renderer path encountered sustained low frame rate on the target webcam. A direct native diagnostic then delivered fresh stable landmarks, so I moved desktop live capture onto that native path.

## Prize Categories

**Best Thoughtful Real-World Use**

Inflect is designed for adults practising a small part of facial grammar alongside qualified ASL teaching. It keeps the task focused, offers written and optional spoken guidance, and distinguishes usable measurements from gaps. Camera consent, local summaries, explicit deletion and clearly labelled example data are part of the main experience.

## Consent and Data Handling

- **Consent:** camera use starts after an adult-consent checkbox and an explicit connect action.
- **Capture:** Inflect requests video only, records no video and uploads no camera frames to an Inflect server. Camera mirror uses browser permission; native live capture also depends on operating-system camera access.
- **Stopping:** Stop camera, leaving practice, hiding the app or closing it releases capture.
- **In-memory data:** the key, raw landmarks and calibration stay in memory. Inflect does not write them to history or exports.
- **Local retention:** completed live and mirror summaries are stored locally, limited to the most recent 60. They have no automatic time-based expiry. Users can export a summary or clear history in My sessions; exported files are managed separately by the user.
- **SDK services:** telemetry and accumulated metric output are explicitly disabled. Presage network access is still required for authentication and SDK service operations. Presage's own policies govern its service-side data.
- **Voice:** preferences are stored locally. Browser or operating-system speech providers may process fixed cue text; face data and keys are not passed to speech synthesis.
- **AI:** Inflect does not send face data to a runtime generative-AI service. Codex assisted development and debugging.
- **Examples:** the illustrated walkthrough is labelled and cannot enter real practice history.

Sources: [Presage telemetry and privacy](https://smartspectra.presagetech.com/docs/telemetry-and-privacy/), [ASL University non-manual markers](https://www.lifeprint.com/asl101/pages-layout/nonmanualmarkers.htm). Original app illustrations and wording; bundled fonts retain their license files.
