# Lyra SoniLoom v0.3 — Spatial authoring loop

2026-10-02. Implementation is ready for owner listening. Sound realism is not asserted. Real-sample upload expansion and external sample acquisition remain deferred by the owner's instruction.

## Final behavior and approved boundary

Owned per-layer early reflections and diffuse damped late reverb, independent dry/early/late audition and export, six direct room controls, validated conversational room edits and audition-only RMS reference matching. No external audio generator, model training, node editor, new dependencies, or shared-bus ownership. Existing WAV import behavior is unchanged.

New projects use schema 2 / engine 0.3. Legacy schema 1 / engine 0.1 is still supported with identical rendering. Legacy projects opt in through an undoable Enable spatial authoring action; this preserves dry source rendering. An older application cannot open schema 2 projects.

## Evidence

- Automated: **33 tests passed**, including old project hashes, bypass identity, deterministic/causal room stems, decay response, silence, protected PCM, scoped proposals, undo, persistence and audible-subset RMS matching. Earlier tests were observed failing before implementation. Three old project WAV hashes are unchanged.
- Artifacts: garage dry/room, metal approximation and orbital examples reopen and render to exact saved WAV bytes; all have zero clipped samples. The room version's dry stem equals the dry comparison byte-for-byte before 16-bit quantization. `render-evidence.json` holds hashes, peaks and RMS.
- Provider: **four new paid calls** this iteration. Three scripted sequential edits of the same garage layer (early .28, decay .65, tail .18) each changed exactly one field, preserved source IDs, preserved dry PCM and preserved a locked second layer. A fourth actual Chrome conversation proposed and applied early .6 → .22 on the selected orbital layer; UI showed one computed change and required Apply.
- Total ledger across v0.2 and v0.3: 13 calls, estimated USD **0.03414225**, permanent conservative reserve **1.95**, remaining allowance **3.05**, unsettled **0**. Estimates are token-based, not an account invoice. The existing USD 5 cap and key were retained.
- Browser: Chrome manual early/tail edits, undo/redo, tail isolation, play/stop state, Solo/reference RMS mode switching and real AI proposal Apply exercised. Reload recovered the saved schema 2 parameters. No relevant warning/error console entries observed. Desktop default 1920×876 and 1440×900; 390×844 geometry had document width 390 with no horizontal overflow. Mobile tail decay .8 → .15 → Undo .8 was exercised.
- Browser downloads: full-mix WAV, isolated late WAV and portable schema 2 project reached Downloads. The downloaded project was parsed and its late stem rerendered to exactly match the downloaded late WAV. Download-event APIs timed out despite actual file completion; success is based on files, not a toast. See `browser-download-evidence.json`.
- Independent review found an RMS+Solo mismatch and stale export wording; both were fixed. A new regression proves audible solo/reference matching and unchanged export PCM. Reviewer also tested 64 malformed inputs and 16 extreme room configurations.

## Listening files

- `garage-v02.wav`: original AI-designed complete v0.2 gunshot including its old synthetic spatial layers.
- `garage-dry.wav`: original muzzle/body sources with old delay removed; old synthetic reflection/tail layers excluded.
- `garage-room.wav`: exactly the same dry sources plus the new v0.3 room.
- `garage-dry-matched.wav`, `garage-room-matched.wav`: attenuation-only RMS matched versions for a fairer A/B comparison. RMS matching does not guarantee perceptual loudness equality.
- `garage-early.wav`, `garage-late.wav`: isolated spatial components.
- `garage-ai-refined.wav`: same source after the three real conversational spatial edits; portable project included.
- `metal-room.wav`, `orbital-room.wav`: procedural regression examples, not real recordings.

The v0.2-full vs v0.3-room comparison changes the spatial construction; it is not a pure source-only comparison. The controlled dry-vs-room pair changes only the added room, apart from explicit playback-copy RMS attenuation. There are no newly acquired samples.

## Files changed and purpose

- `src/spatial.mjs`: owned six-tap early reflections and damped comb/all-pass late room, deterministic per layer.
- `src/project.mjs`: paired schema/engine validation, bounded optional room values, explicit upgrade and undo.
- `src/engine.mjs`, `src/render-worker.mjs`: retain legacy layer synthesis; add separate stems, transfer buffers and actual-audition matching.
- `src/ai-contract.mjs`, `server/ai.mjs`: bounded room fields, schema-aware metadata, no silent AI upgrades, same scope/locks/atomicity.
- `src/app.mjs`, `index.html`, `styles.css`: room inspector, separate Listen/Export controls, matching and correct export labels.
- `server.mjs`, `package.json`: version label only. Original 8795 development service restarted to load updated backend. Temporary 8796 verification service remains available for the retained Chrome workbench.
- `tests/spatial.test.mjs`: focused spatial/legacy/AI/audition regressions.
- `scripts/render-v03.mjs`, `scripts/live-v03.mjs`: repeatable artifact and explicitly paid provider acceptance. Do not rerun paid acceptance casually.
- `README.md`, `docs/V0.3-ACCEPTANCE.md`, `outputs/v0.3/`: factual usage, approved scope, results and deliverables. Baseline source snapshot kept in /private/tmp/soniloom-v03-baseline.

## Limits, incomplete evidence and known issues

- Owner listening and blind preference evaluation are pending. There is no claim of realistic gunshots, calibrated RT60, geometric acoustics or improved subjective quality. Spacing/decay are algorithm controls. Physical output at the user's device was not independently heard.
- Browser **Open** of an external portable file is still unverified this iteration: Chrome's extension lacks file-URL access; IAB file chooser timed out; native chooser was unavailable while the Mac was locked. No extension/OS security setting was changed. Parsing, original asset integrity tests, artifact roundtrips and browser reload recovery are distinct verified layers.
- Provider free-form prose used completed tense before Apply once despite its instruction. UI correctly labeled the proposal not applied, showed unchanged state, and required Apply. The numerical patch was correct; natural-language explanation correctness is not a formal guarantee. This inherited model-prose limitation was observed and recorded, not broadened into a new language-sanitization subsystem.
- Isolated stems audition all layers and disable M/S. Dry includes existing pre-room creative delay. Room tails stop at project end; longer room tails need a longer project, which is blocked while any layer is locked.
- Maximum 16-layer/30-second mobile memory and render latency are not benchmarked. Per-layer rooms cost more CPU than a shared room bus; no performance promise is made.
- No Git operations, dependency installation, deployment, other-repository changes, account settings or public sharing. User-authorized private Google Drive delivery is separate from product functionality.

Stop at this loop. Real-sample import/editor expansion awaits the owner's evening discussion.

## Private delivery outcome

Dry matched WAV, room matched WAV and spatial UI screenshot were uploaded successfully to the owner's Google Drive; metadata readback is used to verify owner-only access. A proposed listening ZIP upload was rejected by automatic approval review because it also contained editable project files, acceptance notes and other artifacts beyond the confirmed audio/screenshot payload. It was not retried or uploaded by another route; the ZIP remains local.
