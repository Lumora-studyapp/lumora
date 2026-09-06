# Focus stage transition validation

Reference: `Screen_Recording_20260906_172902_FC Mobile.mp4` (updated September 6 reference only). Extracted 49 timestamped frames at 33.33 ms intervals, 10.98–12.58 s, using seekable local media and Chrome canvas decoding. Source dimensions: 2316 × 1080.

The reference contact sheet and preview recording are in `artifacts/stage-transition/` (local, excluded from Git). Open `preview-recording.html` to replay the captured browser frames. This is a QA recording, never an application asset.

## Comparison and implementation

Burst duration is 1550 ms. The two broad chevrons enter rapidly, brighten, then remain across the majority of the character before accelerating upward and disappearing. Their gold faces and shimmer are explicitly layered in front of both character stages, while three expanding circles sit behind them. The character exchange occupies the final third of the burst: the outgoing stage moves upward and fades while the incoming stage rises from below, overshoots to 108%, then settles through two small rebounds. Echoes disappear at completion.

The persistent stage pill above the timer has been removed for every skin. The transition is centered on the character artwork, and its SVG canvas is 700 × 700 CSS pixels—exactly 250% of the previous 280 × 280 size. All character skins use the same outgoing/incoming stage exchange through the shared progression lookup. No game artwork, game text or unrelated interface is included. Pale yellow is intentionally lower contrast on Lumora's light background than on the reference's black background.

CSS animates transforms and opacity only; gradient glow is prebuilt, no animated blur or filters, no React frame loop. Native document animation timing permits the browser's available refresh cadence; no JavaScript 60 Hz cap. Duration is fixed in milliseconds. Timer ownership and ticking are unchanged.

Stage advancement is observed from the real FocusScreen's elapsed-derived stage (including cumulative Pomodoro focus seconds). Session/stage high-water marks consume each advancement once. Initial mount/restoration is a baseline; paused, break, hidden and disabled advancements are consumed without queuing. Unmount removes the CSS animation and clears the fallback timeout and visibility listener. A hidden document cancels the current burst. Existing device-mode low-power heuristic (four or fewer cores or GB RAM) suppresses it. Animation-off and reduced-motion hide the effect and immediately expose the current badge.

## Measured results

Earlier desktop headless Chrome validation, 412 × 915 viewport, device scale 1:

- Without recording overhead: 102 requestAnimationFrame intervals; median 16.70 ms, p95 16.90 ms; no intervals above 25 ms.
- With DevTools screencast active: 93 intervals; median 16.70 ms, p95 16.80 ms; 3 intervals above 25 ms.
- 0 observed long tasks, 0 uncaught page errors; 91 recorded preview frames.
- These measure desktop frame scheduling under recording overhead, not Android GPU presentation or a guaranteed sustained 60 fps.
- Real FocusScreen in React StrictMode: one start for advancement, no repeats for rerenders, pause/resume, or remount at the same elapsed time. Next advancement starts once. The next character image is preloaded during the prior stage. The recording verifies stage-one and stage-two image sources in the live transition and confirms no visible static stage pill. Disabling during playback cleans up; re-enabling does not replay. Low-power, animation-off and reduced-motion checks pass. Navigation removes the effect. Timer changes from 01:00 to 01:01 during the burst.
- 24 Node tests pass, including four event lifecycle regression tests; production build passes with the existing large bundle warning.

`adb devices` reported no connected Android devices. Physical Android/WebView frame pacing, GPU memory, thermal throttling, battery saver signals beyond the existing heuristic, and 90/120 Hz displays remain untested. No Android performance claim is inferred from desktop results.

Live UI verification on September 6 used the running localhost Focus session without altering its clock. The session resumed at 02:02, crossed the 03:00 and 04:00 boundaries, and visibly advanced Elon Musk from stage 3 through stage 5. It was returned to paused at 04:22. The deterministic capture was then reviewed at several points across the burst to confirm the chevrons stay in front of and across the character, and the incoming stage visibly overshoots and settles.

## Reproduce

## Compact localhost regression fix

The actual localhost app had a 493 × 632 viewport. Its `max-height: 720px` media query applied `max-height: 220px` to every descendant SVG in `.sg-session-tree`, including the 700px transition SVGs. Their negative 350px centering margin stayed unchanged, shrinking and displacing the arrows above the character. The earlier 915px-tall harness missed this responsive rule.

The compact SVG constraint now targets only direct tree SVG children. Transition SVGs explicitly use `max-height: none`. The browser regression harness now includes `.sg-shell` and uses 493 × 632, asserting the computed transition dimensions remain 700 × 700. Lifecycle checks and the production build pass.

After fixing the CSS, the real app on port 5174 ran from 00:00 through 01:00 and 02:00 without changing its clock. At 02:00, six live screenshots captured the incoming arrows, their overlap with the character, the stage 2 → 3 exchange, and the settled new character. DOM inspection confirmed `sg-stage-rise`, `sg-stage-skin-in`, and a 700px SVG height. The test session was paused at 02:15. This verifies visible animation, beyond merely observing a changed stage label.

The final compact desktop run measured median 16.7 ms and p95 16.8 ms across 103 unrecorded requestAnimationFrame intervals, with no intervals above 25 ms. Android remains untested.

Run `npm run dev -- --host 127.0.0.1`, then `node scripts/inspect-stage-reference.cjs` and `node scripts/verify-stage-transition.cjs`. The scripts use this workstation's bundled Playwright and Chrome paths. `scripts/stage-preview.html` imports the actual FocusScreen with controlled elapsed time; it is a development harness and is not part of the production entry point. Run `npm test` and `npm run build` for regression/build checks.
