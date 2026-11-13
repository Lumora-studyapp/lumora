# Sound & Audio

Open the main menu → Sound & Audio. Save applies the master switch, effects
volume and each event's enabled state and style to the signed-in account's
existing Firebase `prefs/{username}.soundEffects` field. A per-user device
cache preserves settings when offline. The panel reports cloud sync failures
and lets the user retry Save. Closing before Save cancels preference changes.

The six cues are generated locally using Web Audio sine oscillators and short
gain envelopes. They require no hosted audio assets, storage bucket, downloads
or external audio service. Soft, Warm and Glass vary the pitch of each cue.
Effects have their own audio context and gain, independent of background media.
Master mute stops active and queued effects. Previews respect master volume,
and intentionally bypass the individual event switch. Browser autoplay rules
still require a user gesture; suspended/background browsers may silence cues.

Timer-goal completion, confirmed session completion, Pomodoro breaks, confirmed
task completion, newly earned badges and crossed lifetime milestones use the
same engine. Duplicate and overlapping cues are suppressed; a milestone may
follow the current cue. Cloud hydration and already-saved session retries do
not deliberately replay sound history.

Regression coverage: `node --test src/soundEffects.test.js src/authFlows.test.js`.
Real provider sign-in and cross-device Firebase sync require an authenticated
browser on the deployment being reviewed.
