# Architecture

The UI uses plain ES modules, CSS and original SVG. The build copies it to dist and creates a source download. The legacy renderer adapter remains bundled for compatibility; the 0.1.3 desktop shell exposes the native camera bridge.

## Desktop camera

The sandboxed renderer has context isolation and no Node integration. Its preload exposes only start, stop and subscription methods. The main process checks the sender, main frame and bundled page URL before accepting camera commands. External navigation is blocked and approved HTTPS documentation opens externally.

After explicit adult camera consent, NativeCameraHost constructs SmartSpectraSDK with FACE_LANDMARKS only, telemetry disabled and accumulated output disabled. It calls useCamera(CameraSelection.default, {width:640,height:480,fps:30}), matching the successful direct-camera diagnostic. The SDK owns capture. Live mode does not create a browser MediaStream or copy video input frames through Electron.

The main process decodes metrics through @smartspectra/node-sdk/messages. Only timestamped landmarks, guidance, processing state and errors reach the UI. The UI renders those real pixel landmarks as a mirrored face view, with highlighted brows. No synthetic landmark source is used by live mode.

Start and teardown are serialized. Stop immediately disarms retired callbacks. New sessions await native stopAsync and destroy; stale renderer stop requests cannot stop a replacement. Navigation, renderer failure and window closure retire capture. App shutdown awaits cleanup. Failed destruction must succeed before another session starts.

Camera mirror remains a separate browser getUserMedia path with a real video preview and no automatic assessment.

## Measurement pipeline

Camera → native SmartSpectra → decoded landmark packets → timestamp/stability/geometry gate → personal calibration → movement observation → prompted-timing review.

Coordinates follow the SDK's documented 478-point map. Brow height is measured against the eye axis and normalized by eye separation. Inner-brow spacing is an additional feature. These are engineering choices, not validated ASL classifiers.

Calibration uses relaxed, raised and furrowed samples, robust centers and noise. Unseparated classes fail. Ambiguous or outlying positions remain unknown. Timestamp age, order, resets, unstable tracking and invalid coordinates are handled explicitly. Actual observations are never interpolated across large gaps.

All three poses keep one camera session. Capture waits for fresh usable landmarks, and its deadline does not depend on animation frames. An interruption cancels unfinished calibration and offers an explicit reconnect.

The illustrated source is separate and always labelled. Its deterministic trace can survive delayed redraws because it is synthetic; that filling function is never used for live observations. Storage independently rejects illustrated sessions.

History contains only completed aggregate summaries. No key, raw coordinates, calibration template or video is persisted. No app backend, analytics, database or remote-font request is required.

## Remaining validation

The direct native diagnostic succeeded on the user's Windows webcam. The updated desktop flow has passed synthetic integration checks, including its real Electron IPC bridge. The builder has also completed a live desktop drill and supplied its review and exported session; see live-run-2026-11-22.md. Longer runs, different hardware, consenting learner tests and educator review are also pending.
