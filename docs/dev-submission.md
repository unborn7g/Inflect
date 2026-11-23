---
title: "Inflect: Let your face ask the question"
tags: devchallenge, presagechallenge
cover_image: https://inflect-practice.vercel.app/assets/inflect-cover.jpg
---

*Submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).*

## What I Built

When you practise a facial movement on your own, you are doing two things at once: following the example and trying to watch yourself. You can repeat the movement and still be unsure when your brows actually lifted or returned to rest.

I built **Inflect** to make that moment easier to look back at.

It is a small practice studio for adults beginning ASL who want to pay attention to their brow movements between lessons. Choose a movement, watch the illustrated guide, and try a 20-second drill with two short cues. Afterwards, look at where your movement matched the cue and where tracking was available.

In desktop live mode, you first calibrate comfortable relaxed, raised and furrowed positions to your own face. That gives the app a personal reference for the practice that follows. Written cues are always available, with optional spoken guidance when your device supports it.

Twenty seconds keeps the task small: one movement to focus on, two cues to follow, and something concrete to review before trying again.

Live Presage feedback runs in the **desktop app**. The **browser studio** offers a camera mirror for self-review and a clearly labelled illustrated walkthrough.

Inflect is intended to sit alongside qualified ASL instruction. It observes prompted brow movement; it does not assess signing ability. Educator review and learner evaluation are still ahead.

Built solo by **unborn**, with Codex assistance.

## Demo

[Watch the live session and narrated walkthrough](https://inflect-practice.vercel.app/demo/) · [Try the browser studio](https://inflect-practice.vercel.app/)

The first video is a **68-second continuous recording of my desktop session**. It shows the live Presage landmark view, personal calibration, the complete 20-second drill and the actual review. The calibration retry is kept in the recording too.

In that run, the two four-second cues recorded **2.3 s and 3.0 s of matching movement**, with **3.9 s and 4.0 s of usable tracking**. These are the app’s observations from that session, not validated accuracy scores.

The clip is silent, with written cues visible, and plays at its original speed. Only the recording’s beginning and end were trimmed. A **2:27 narrated walkthrough** follows, using labelled examples and evidence from an earlier live session to explain the rest of the app.

[Recording details and limits](https://github.com/unborn7g/Inflect/blob/main/docs/live-run-2026-11-23.md) · [Earlier integration checks](https://github.com/unborn7g/Inflect/blob/main/docs/live-run-2026-11-22.md)

## Code

[Public repository and setup instructions](https://github.com/unborn7g/Inflect)

To try desktop live feedback, you need Node.js 20+, a supported camera and a valid Presage key. From the project folder, run:

```sh
npm ci
npm start
```

Choose **Practice → Use my camera → Live movement feedback**, enter your key locally, confirm consent and wait for clear tracking before calibration. No Inflect account is needed.

The repository includes **112 automated checks** and an Electron flow check. The automated tests use synthetic fixtures to check implementation behaviour; evaluating the feedback with learners remains future work.

## How It Responds to Human Signals

In desktop live mode, **Presage SmartSpectra 3.5.0** supplies **FACE_LANDMARKS**. Inflect uses those measurements to observe brow movement as the learner follows the cues.

Personal calibration establishes reference positions that the app can distinguish. During the drill, Inflect compares brow height and inner-brow spacing with those references. Usable matches contribute to the timing review, including how long the movement matched and when the first match appeared.

When tracking drops, practice pauses. Stale, unstable or ambiguous measurements stay unscored. An SDK interruption cancels unfinished calibration, and the learner can reconnect manually.

The technical path is straightforward: the native SDK owns camera capture, requesting 640×480 at 30 fps. Decoded landmarks and guidance cross a restricted bridge into the sandboxed interface. Brow measurements use the documented 478-point topology.

[More about the signal path and architecture](https://github.com/unborn7g/Inflect/blob/main/docs/architecture.md)

## Prize Categories

**Best Thoughtful Real-World Use**

I wanted to give an adult ASL beginner a focused activity they could return to between lessons: watch a guide, try one movement, and look back at its timing. Clear cues, explicit camera consent, local summaries and visible tracking gaps are part of that experience.

**Most Creative or Delightful Use**

I like the idea of an ordinary laptop camera helping someone notice a small movement they might otherwise miss. Inflect pairs original illustrated guides with feedback calibrated to the learner’s own face, making that movement visible during a short practice.

## Consent and Data Handling

Camera use should be a clear choice. Here is what happens when someone practises with Inflect:

- Camera capture begins after adult consent and an explicit connect action. The app requests video only.
- Inflect records no camera video and uploads no camera frames to an app server. The demo above was captured separately as a screen recording.
- Stopping the camera, leaving practice, hiding the app or closing it releases capture.
- Keys, raw landmarks and calibration stay in memory and are excluded from history and exports.
- The most recent 60 completed summaries remain on the device until cleared or replaced. Users can export or delete history; exported files are managed separately.
- SDK telemetry and accumulated output are disabled. Presage still performs authentication and service operations under its own policies.
- Voice preferences are local. A system speech provider may process fixed cue text; keys and face data are not passed to speech synthesis.
- No runtime generative-AI service receives face data. The illustrated walkthrough is labelled and excluded from real history.

[Presage privacy](https://smartspectra.presagetech.com/docs/telemetry-and-privacy/) · [ASL context source](https://www.lifeprint.com/asl101/pages-layout/nonmanualmarkers.htm)
