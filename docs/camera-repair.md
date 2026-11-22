# Camera and calibration repair — 0.1.1

## Confirmed code defects

- A stopped camera or SDK cleared the capture state but left the calibration dialog open with a disabled capture button and its last countdown.
- A reconnect could begin while an earlier detached SDK was still shutting down.
- A cancelled connection resolving or rejecting later could stop a newer connection.
- A late ended event from a retired camera stream could stop its replacement.

The source does not stop the camera simply to advance from relaxed to raised. The specific native failure on the user's computer has not been reproduced with an authenticated camera here.

## Changes

- Camera and SDK interruptions cancel the capture deadline, close the stale calibration dialog, clear incomplete calibration, and offer reconnection with the failure message.
- Calibration capture waits for fresh landmarks. A deadline independent of screen redraws finishes each capture, restoring the capture button when samples are unavailable.
- All three calibration positions retain the same camera and SDK session.
- SDK frame forwarding is stopped before original camera tracks are released. Reconnection waits for earlier cleanup.
- Retired SDK callbacks, cancelled start results, and old track-ended events cannot change a new session.
- Hiding the app still stops the camera. The calibration dialog explains this behavior.

## Verification — 22 November 2026

- JavaScript syntax and content-security-policy check: passed (23 modules).
- Automated tests: 78 passed, including 23 new camera/session lifecycle regression tests.
- Native SDK import smoke check: passed, SmartSpectra 3.5.0 and FACE_LANDMARKS code 11.
- Production bundle and source ZIP: built successfully.
- Authenticated live camera/calibration and device-specific behavior: not run; verify on the user's computer.
- Automated lifecycle tests use controlled SDK/camera substitutes and execute the application handlers. They do not establish camera hardware reliability, ASL accuracy, or learning outcomes.

## Install

Close the previous Inflect window. Extract the repaired source into a new folder, open a terminal inside its inflect folder, and run npm ci followed by npm start.

Choose Live movement feedback, enter the key inside the app, and keep Inflect visible through relaxed, raised, and furrowed captures. If processing stops, record the displayed error and use Reconnect live feedback.
