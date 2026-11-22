---
title: "Inflect: Let your face ask the question"
published: false
tags: devchallenge, presagechallenge
---

*Submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).*

## What I Built

**Inflect is a desktop studio for practising the brow movements used in ASL questions.**

Watch an original movement guide, calibrate relaxed, raised and furrowed positions, follow a 20-second drill, then review movement timing. Written cues and optional spoken guidance keep the task focused.

Three modes distinguish live Presage feedback, camera-mirror self-review and a labelled illustrated walkthrough. Inflect supports adults learning alongside qualified instruction. Educator review is pending; the app assesses prompted brow movement, not ASL proficiency.

Solo build by **unborn**, with Codex assistance.

## Demo

[Watch or download the narrated MP4](https://github.com/unborn7g/Inflect/raw/refs/heads/main/demo/inflect-demo.mp4)

The video combines **verified live-run screenshots and the exported review** with a clearly labelled recording of the illustrated walkthrough. It contains no continuous live-camera recording.

The actual Windows live run displayed 1,128 landmark samples and completed a 20-second session with observations for both cues. [Evidence and limits](https://github.com/unborn7g/Inflect/blob/main/docs/live-run-2026-11-22.md).

## Code

[Public repository and setup](https://github.com/unborn7g/Inflect)

With Node.js 20+, a supported camera and a valid Presage key:

```sh
npm ci
npm start
```

Choose Live movement feedback, enter your key locally, confirm consent and wait for clear tracking before calibration. No app account is needed.

The repository includes **112 automated checks** and an Electron flow check. These implementation tests use synthetic fixtures and do not establish feedback accuracy.

## How It Responds to Human Signals

Presage SmartSpectra 3.5.0 supplies **FACE_LANDMARKS**. The native SDK owns capture, requesting 640×480 at 30 fps. Decoded landmarks and guidance cross a restricted bridge to the sandboxed UI.

Inflect normalizes brow height and inner-brow spacing using the documented 478-point topology. Personal calibration determines distinguishable positions. During prompts, the app records usable matching time and the first observed match.

Stale, unstable, reset or ambiguous measurements remain unscored. Tracking loss pauses practice; SDK interruptions cancel unfinished calibration and allow a manual reconnect. These are engineering observations requiring further learner evaluation.

## Prize Categories

**Best Thoughtful Real-World Use**

A small, concrete practice task with readable guidance, explicit consent, local summaries and honest handling of missing tracking.

## Consent and Data Handling

- Camera capture begins after adult consent and an explicit connect action.
- Inflect requests video only and records no camera video. It uploads no camera frames to an app server.
- Stop, leaving practice, hiding the app or closing it releases capture.
- Keys, raw landmarks and calibration stay in memory and are excluded from history and exports.
- The most recent 60 completed summaries remain locally until cleared or replaced. Users can export or delete history; exported files are managed separately.
- SDK telemetry and accumulated output are disabled. Presage still performs authentication and service operations under its own policies.
- Voice preferences are local. A system speech provider may process fixed cue text; keys and face data are not passed to speech synthesis.
- No runtime generative-AI service receives face data. The illustrated walkthrough is labelled and excluded from real history.

[Presage privacy](https://smartspectra.presagetech.com/docs/telemetry-and-privacy/) · [ASL context source](https://www.lifeprint.com/asl101/pages-layout/nonmanualmarkers.htm)
