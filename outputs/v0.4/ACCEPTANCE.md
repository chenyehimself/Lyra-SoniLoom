# Lyra SoniLoom v0.4 acceptance — 2026-10-02

## Delivered boundary
Local short-WAV selection and editing, owned rendering, numeric metadata for scoped AI proposals, portable original-source integrity. No external file upload, sample acquisition, separation, model training, dependencies, Git actions or deployment. The local loopback server was restarted at http://127.0.0.1:8795/.

## Changes and purpose
- `src/project.mjs`, `src/assets.mjs`: schema 3 / engine 0.4, paired source bounds and explicit undoable legacy opt-in.
- `src/sample.mjs`: validated sample-frame bounds and bounded numeric source measurements.
- `src/engine.mjs`: selected-window playback, fades at selected playback end, bounded forward/reverse interpolation; old schema render hashes retained.
- `src/sample-editor.mjs`, `src/app.mjs`, `styles.css`: original waveform, drag/numeric selection, fit-duration action, source/playback distinction and locked controls.
- `src/ai-contract.mjs`, `server/ai.mjs`: numeric metadata projection and selected-layer window edits with existing validation and atomic apply.
- `index.html`, `package.json`, `server.mjs`, `README.md`: version and factual usage updates.
- `tests/sample-edit.test.mjs`, `tests/spatial.test.mjs`: focused source-window regression coverage and current new-project schema expectation.
- `scripts/render-v04.mjs`, `scripts/live-v04.mjs`, `docs/V0.4-ACCEPTANCE.md`, this output directory: approved acceptance plan, fixtures and evidence.

## Automated and persisted artifacts
43 tests passed, zero failed. Coverage includes legacy WAV hashes, excluded-source invariance at fractional rates in both directions, one-frame reverse interpolation, invalid bounds, locks, undo, source integrity, metadata validation and portable roundtrips.

`artifact-evidence.json` confirms unchanged source bytes and identical persisted-project PCM for the synthetic sample plus owned room/synth fixture. `browser-export-evidence.json` confirms the actual downloaded WAV is byte-identical to rendering the actual downloaded portable project, and the embedded WAV equals the original file. Browser project: sourceIn 0.23, sourceOut 0.85, clip duration 0.62 seconds.

## Browser evidence
Fresh local IAB interactions verified WAV import, typed numerical selection, blank-input rejection without revision/source change, waveform drag as one revision, Undo/Redo, lock disabling selection inputs, explicit fit duration, solo audition transport, Save project, Export WAV, and reopening the downloaded project with source integrity verification. `editor.jpg` shows the recording editor. The browser downloaded actual files to disk; verification did not rely on a download-request toast.

Automation fill did not produce a native committed change; typing and blur did. The initial file-chooser operation waited abnormally long, but later Open completed immediately. No product import failure was inferred from that tooling delay. Audition reached a running transport; no human listening claim is made. Mobile performance and maximum-sized recordings were not measured in this iteration.

## Real provider evidence
Three sequential real requests changed only sourceIn to 0.23, sourceOut to 0.85 and release to 0.18 on the selected sample. Each produced exactly the expected field delta. Original assets and protected-layer PCM remained identical; renders had no clipped samples. See `provider-evidence.json` and `source-ai-refined.soniloom.json` / `.wav`. These provider checks used the local API and actual proposal/apply contract, not the browser chat send flow.

Original cumulative USD 5 ledger preserved: 16 calls total, USD 2.40 conservatively reserved, USD 2.60 allowance remaining, USD 0.0407985 cumulative token-cost estimate, zero unsettled calls. This iteration added 3 calls, estimated USD 0.00665625. These are local estimates, not an account billing reconciliation.

## Independent review and limits
An independent read-only review found two in-scope defects: reverse endpoint interpolation and blank numeric input coercion. Both were fixed. The reviewer reinspected both fixes and found no remaining issue in that follow-up scope. Reverse behavior has an automated regression; blank rejection was verified in the actual browser.

All verification sources are synthetic test signals, explicitly labeled. No real-world recording quality, microphone capture, physical-room accuracy, semantic recognition or human listening is claimed. Rate changes pitch and speed together; no pitch-independent stretching, denoising or separation. This is ready for the owner's clean short recording and listening session. Known broader limitations (fixed processing chain, model wording, maximum-size performance) remain as documented; no unrelated work was added.
