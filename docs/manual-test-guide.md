# Manual test guide

Use an adult volunteer who consents. Keep private keys and face recordings out of the repository. Record actual outcomes, including failures.

## Browser

1. Open the studio. Confirm camera off and no fabricated history.
2. Select each drill. Verify the guide, active tab and prompt windows agree.
3. Play and pause the movement guide. Let a full cycle run: it must stop after 20 seconds instead of looping indefinitely.
4. Start the illustrated walkthrough. Verify Illustrated preview, Sample data and no camera measurement labels.
5. Pause. Verify the timer stops. Resume, finish, and inspect the review.
6. Open My sessions. The walkthrough must not appear.
7. Open Field notes and Live setup. Check links and the source download.
8. Test Tab/Enter/Escape, visible focus, arrow-key lesson selection, and narrow-window layout.
9. Check each lesson's English context and explanation. They must describe brow practice rather than claim a complete signing demonstration.
10. Toggle Focus view while idle, running and paused. The camera/guide area should enlarge without restarting the timer or requesting a new camera permission. Exit focus to restore the brief. Changing lessons should also restore the brief.
11. The Session timeline starts collapsed. Expand it during/after a walkthrough and confirm the trace and timer agree. The controls must remain available without expanding the timeline.
12. Select Use my camera in a hosted browser. It should open mirror consent directly. Decline or omit consent: no capture should start. Camera options should still offer the camera-free walkthrough and desktop setup route.

## Voice and practice flow

1. Open a fresh page. Confirm no speech plays before a user action. The Watch / Practise / Review steps and current instruction must be visible.
2. Open Voice settings. Choose an available English voice, change pace and volume, and select Test voice. Confirm the sample is audible on the target device; an unavailable voice must show a useful written fallback. Record the OS, browser and voice used.
3. Start the guide and each of the three drills. Check that the spoken instruction, illustrated movement and written cue agree at the ready, movement, rest and finish transitions. A held cue must not repeat on every animation frame.
4. Mute during a cue. Speech must stop immediately while the written instructions and timer continue. Set volume to zero and confirm silence. Restore volume and voice, then check the next cue.
5. Pause mid-cue using the button or Space outside a form control. Speech and time must stop. Resume: only the current instruction should play, without old queued speech. Escape also pauses practice.
6. Open Voice settings during a drill. Practice must pause. Close the dialog, check focus returns to its trigger, then resume explicitly.
7. Complete the session. Check the completion cue, focused review heading, Review session action and Try again / next cue actions. Illustrated results must stay out of history.
8. Reload. Voice preferences should remain, without automatic speech. Test a browser with no speech support or voices and verify captions, countdowns and practice remain usable.
9. Leave practice or hide the page during speech. Playback must stop. Test a slow/network device voice and note delayed or cut-off cues; reduce the pace only if the instruction still fits its practice window.

## Mirror

1. Choose Camera mirror. Try to continue without checking consent: no camera request should occur.
2. Confirm consent and permit video. Check preview mirroring and the absence of microphone access.
3. Complete a drill. The review must state that no automatic assessment was made.
4. Check the locally saved mirror summary. Export it and verify no key, calibration, coordinates or video.
5. In separate runs, stop capture, leave practice, hide the page and close the app. Check the camera indicator turns off.
6. Deny permission and check the error/retry route. Do not bypass browser security warnings.

## Presage desktop

1. Follow the README, launch the desktop app, and enter your own key locally.
2. Confirm consent. Verify Presage live, the measured landmark view and an increasing landmark count. Wait for clear tracking before capturing. The native live view does not open a second browser video stream; use Camera mirror separately for video.
3. Capture clear relaxed, raised and furrowed positions. Verify distinguishable movement observations.
4. Deliberately repeat almost-identical positions: calibration must fail rather than imply reliable feedback.
5. Complete a drill and compare the trace/report with your actual movements.
6. Cover your face or turn away. Live practice must pause; missing data must remain unscored.
7. Return into view and resume only with clear tracking. Recalibrate if tracking resets.
8. Repeat with glasses, a modest distance change and small head roll. Record false observations.
9. Test invalid key, disconnected network and camera already in use. Check useful errors and cleanup.

For every test record commit, OS, camera, lighting, expected behavior, actual behavior and pass/fail. Record video only with separate consent before sharing. Ask a qualified ASL educator to review source context and feedback; do not claim endorsement before it exists.
