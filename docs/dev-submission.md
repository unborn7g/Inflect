---
title: "Inflect: Let your face ask the question"
tags: devchallenge, presagechallenge
cover_image: https://inflect-practice.vercel.app/assets/inflect-cover.jpg
---

*Submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).*

## What I Built

**Inflect is for adults beginning ASL who want a focused way to observe brow movement between lessons.**

A learner practising alone can follow a movement guide, but noticing when their own brows lift, settle or move inward is a separate task. Inflect puts the guide, practice cues and a review in one place.

Watch an original illustration, calibrate relaxed, raised and furrowed positions to your own face, follow a 20-second drill, then review where movement matched the cue and where tracking was usable. Written cues and optional spoken guidance support the same short practice.

Live Presage feedback runs in the desktop app. The browser studio offers a camera mirror for self-review and a clearly labelled illustrated walkthrough. Inflect complements qualified instruction. Educator review is pending; the app assesses prompted brow movement, not ASL proficiency.

Solo build by **unborn**, with Codex assistance.

## Demo

[Watch the live run and narrated product demo](https://inflect-practice.vercel.app/demo/) · [Try the browser studio](https://inflect-practice.vercel.app/)

The demo page opens with a **68-second continuous recording** of actual desktop Presage landmarks, personal calibration, a full 20-second raised-brow drill and its review. The two four-second cues reported **2.3 s and 3.0 s of matching movement**, with **3.9 s and 4.0 s of usable tracking**. These are rounded app observations, not validated accuracy scores. The silent clip retains the written cues and runs at its original speed. [Recorded run and limits](https://inflect-practice.vercel.app/demo/inflect-live-run.mp4).

The earlier 2:27 product walkthrough follows, with neural narration, moving app footage, word-synced captions and labelled demonstration data.

Two separate checks support the integration: a direct SDK diagnostic received **101 stable landmark packets**; a subsequent desktop practice run displayed **1,128 landmark samples** and completed the 20-second drill. The two four-second cues had **2.6514 s** and **1.4637 s** of usable tracking (66% and 37% of their cue windows). These describe coverage, not gesture accuracy. [Evidence and limits](https://github.com/unborn7g/Inflect/blob/main/docs/live-run-2026-11-22.md).

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

A focused task for adult ASL beginners, with readable guidance, explicit consent, local summaries and visible gaps when tracking is unavailable.

**Most Creative or Delightful Use**

An ordinary laptop camera becomes a practice partner for a small part of a visual language, pairing original illustrated cues with personally calibrated brow feedback.

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
