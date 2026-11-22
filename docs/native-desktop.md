# Native desktop capture — 0.1.3

The user supplied a successful direct-camera diagnostic on 22 November 2026: SmartSpectra reached running and delivered 101 stable landmark packets, with a final landmark timestamp age of 0 ms. This followed an earlier attempt rejected with HTTP 401 and renderer-path sustained low-frame-rate stops.

## Change

Desktop live mode now uses SDK-owned camera capture through useCamera(CameraSelection.default, {width:640,height:480,fps:30}). It sends decoded landmarks and status to the sandboxed UI. It does not pump browser video frames into the SDK. The live practice and calibration views show real measured landmarks with highlighted brows; the separate mirror mode still provides video.

The capture settings in Connection details are requested values, not measured delivered FPS.

The renderer bridge is restricted to the bundled main frame. Start/stop and asynchronous teardown are serialized. Retired callbacks and delayed old stop commands cannot affect a replacement session. Hiding, leaving, closing and renderer failure release capture. Native errors cancel unfinished calibration. A terminal error state also recovers if its detailed error callback never arrives.

## Checks

112 automated tests, JavaScript/CSP checks, SDK import and production build pass. Actual Electron native loading and camera discovery succeed. An Electron integration check using synthetic landmarks completed all three poses in one session and recovered from a deliberate interruption. See validation.md.

## Live check sequence

1. Close previous Inflect windows and the camera diagnostic.
2. In the repaired inflect folder, run npm start.
3. Choose Camera options → Live movement feedback.
4. Enter the same key locally, confirm consent and connect.
5. Keep the app visible. Wait for live landmarks before capturing each pose.
6. Complete relaxed, raised and furrowed calibration, then a 20-second practice.
7. Confirm the session review and camera-stop behavior. Record any real errors or missing samples.

The native diagnostic succeeded. The builder has now also supplied a completed live desktop drill, review and exported session. See live-run-2026-11-22.md. Further runs and hardware checks remain useful.
