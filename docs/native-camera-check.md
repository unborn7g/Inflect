# Direct native camera check

Run this short diagnostic to check SDK-owned camera capture separately from the app:

1. Close Inflect so it releases the webcam.
2. In the inflect project folder, run npm run camera:check.
3. Copy the key with the copy button in the Presage portal, paste once at the local terminal prompt, and press Enter. The prompt shows only stars and a character count. Press Ctrl+U to clear the entry before pasting again if needed. Entering the key starts a live camera check lasting about 20 seconds, plus startup/shutdown.
4. Keep one face visible with steady front lighting.
5. Read the final RESULT line and any SDK error.

This uses SmartSpectraSDK.useCamera(CameraSelection.default, {width:640,height:480,fps:30}) directly in Node. It does not use the Electron renderer frame-copying path.

The diagnostic requests FACE_LANDMARKS only. SDK telemetry and accumulated output are disabled. It records no video and prints only packet counts, SDK states, guidance, errors and a timestamp-age diagnostic. The key itself is not displayed or saved.

LIVE LANDMARKS RECEIVED means fresh stable 478-point landmark packets were received through the end of the check while the SDK was running, without its frame-rate warning or a fatal SDK error. It is a capture diagnostic, not evidence of ASL accuracy or a completed app demo.

If the SDK reports sustained low frame rate here too, the problem is not limited to Electron's frame-copying path. Preserve the error text for the next troubleshooting step.

For camera discovery without authentication or capture, run node scripts/native-camera-check.cjs --list.

The diagnostic checks cover camera selection, errors, cleanup, masked input, pasted text, clearing an entry and failure classification.

The user’s second live run on 22 November 2026 reached running and returned 101 stable landmark packets, with a last timestamp age of 0 ms and RESULT: LIVE LANDMARKS RECEIVED. Its earlier 401 attempt did not reach measurement. Desktop 0.1.3 now uses the same native camera API; the builder has also supplied a completed live desktop review and exported session. See native-desktop.md and validation.md.
