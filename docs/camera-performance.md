# Camera performance update — 0.1.2

The user's live run reported SmartSpectra's sustained low-frame-rate stop. This identifies why the SDK stopped, while the earlier 0.1.1 repair addressed the frozen recovery screen.

## Changes

- Acquire one camera stream requesting 640×480 at 30 fps, with a 25 fps minimum, and pass it to the SDK through useMediaStream before starting.
- This requests one third of the pixels per frame compared with the renderer SDK's default 1280×720 feed. It reduces conversion, copying and preview work; it does not guarantee a sustained rate on every camera or machine.
- Reuse the overlay canvas unless video dimensions change.
- Show the camera's reported configuration under Connection details. This is a configured rate, not a measured delivered frame rate.
- Surface native frame-rate warnings during calibration. Do not accept calibration samples while the SDK reports its frame-rate warning.
- After a sustained frame-rate stop, offer a user-initiated reconnect with lighting and device-load guidance. No automatic restart loop or fabricated frames.

## Verification

The automated camera/lifecycle, signal, timing, history, voice and guidance checks pass (87 tests). JavaScript/CSP checks and the production build pass. The native SDK 3.5.0 import check passed during 0.1.1 verification; dependencies are unchanged.

Authenticated camera performance at the smaller resolution remains to be verified on the user's computer.

## Retest

Close the existing Inflect window and unused video/browser tabs. Use steady front lighting. Start the repaired copy, choose live feedback, and keep Inflect visible while calibrating. If the SDK stops again, record the displayed reason and the Camera setting field.

## Official references

- https://presagetech.com/docs/smartspectra-sdk/nodejs/api-reference
- https://smartspectra.presagetech.com/docs/measurement-quality/
