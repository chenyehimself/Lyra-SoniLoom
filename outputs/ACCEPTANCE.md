# Lyra SoniLoom 0.1 — Acceptance handoff

Date: 2026-10-02. Status: **local prototype available; acceptance has two environment-related verification gaps and requires human listening**.

## Objective and boundary

Build a standalone local browser sound workbench with owned procedural DSP, imported WAV layers, explicit edits and locks, undo/redo, A/B reference, portable projects and WAV export. The first scenario is an editable spaceship startup/release. Work is confined to `/Users/chenyewang/Lyra-SoniLoom`; existing Lyra project contracts and UI were read only as references.

GPT conversation, model training, arbitrary routing graphs, shared bus effects, external plugins, cloud services, accounts, game-runtime integration and deployment are outside this prototype. There is no simulated AI chat.

## Delivered artifacts

- `orbital-before.wav` / `orbital-after.wav`: 9-second, 48 kHz stereo PCM16 examples.
- Matching `.soniloom.json` files: editable layer definitions, stable layer IDs and locked thruster layer.
- `recording-example.soniloom.json`: portable project containing a synthetic one-second WAV fixture. This demonstrates import persistence; it is not a human recording.
- `audio-evidence.json`: measured peaks, RMS, frame counts and protected-layer comparison.
- `workspace-desktop.png`: actual rendered desktop workbench screenshot.
- `../README.md`: local startup and usage instructions, limits and architecture map.

## Evidence reached

| Evidence level | Result |
| --- | --- |
| Automated unit/regression tests | 12 passed, 0 failed. Deterministic render; unchanged protected PCM; rejected locked/stale edits; undo/redo; invalid project rejection; portable roundtrip; WAV quantization; asset hash tamper rejection; independent mix sum; global duration lock; orphan asset release/undo; oversized valid WAV project rejection. |
| Persisted artifacts | Before/after WAVs and editable JSON written to disk, read back, decoded, and compared byte-for-byte against a fresh render/export of their saved projects. Both 432,000 frames per channel, zero samples exceeding full scale. The embedded-recording project was read back and its asset hash verified. Protected thruster PCM is bit-identical between revisions. |
| Local runtime | Loopback server returned HTTP 200. Browser module worker produced waveforms and meters. |
| Browser interaction | Source selection and parameter edit; layer protection; global length rejection with a locked layer; seek to 9 seconds; Play/Pause/Stop; A/B reference after an edit; solo sample removal restoring full audition; undo restoration; WAV import; local recovery after reload; opening procedural and embedded-recording project files with hash verification. |
| Browser export UI | Save/export produced named download links. Download event and link-download helper timed out in the Codex in-app browser; actual browser-created files were not found/verified. File codec/serialization tests and scripted persisted artifacts pass independently. |
| Browser layout | Actual desktop screenshot and no horizontal document overflow at observed 1280-pixel width. Requested 390×844 viewport override did not change the observed 1280-pixel viewport, including on a new tab. Mobile CSS exists but mobile runtime layout is unverified. Override was reset. |
| Browser console | No captured warning/error entries during the exercised flow. This is limited to that session. |
| Human listening | **Not performed.** Playback controls and rendered PCM are not evidence of speaker audibility, sound quality, realism or user preference. |
| Provider / deployment / production | Not applicable: none used. |

## Example change

Only Energy buildup changed: duration 3.25 → 3.60 seconds, end frequency 980 → 700 Hz, cutoff 5400 → 2800 Hz. Thruster release is locked in both projects and its isolated rendered PCM is unchanged. Other layers retain their definitions.

| File | Linear peak | RMS | Clipped samples |
| --- | ---: | ---: | ---: |
| orbital-before.wav (pre-quantization float render) | 0.466310 | 0.061196 | 0 |
| orbital-after.wav (pre-quantization float render) | 0.531346 | 0.061451 | 0 |

These are sample-peak/RMS checks, not true-peak, LUFS or perceptual quality measurements.

## Review and fixes

One independent read-only implementation review identified four in-scope defects: portable size acceptance, seek value overwritten during stop, stale solo IDs after deletion, and unused recording assets surviving removal. All four were fixed. Focused automated regressions cover project size and asset lifetime; browser interactions verified seek and solo cleanup. A separate lock-tail issue was fixed and tested: global length cannot change while a layer is locked.

The download UI now says a download was requested instead of claiming that a file was saved. A persistent retry link is exposed. This does not resolve or conceal the in-app browser's unverified download completion.

## Acceptance steps for the owner

1. Run `npm start` and open `http://127.0.0.1:8795/` in your desktop browser.
2. Listen to the supplied before/after WAVs; assess character, noise, transients and tails.
3. Open both example projects and compare their editable Energy buildup settings and protected Thruster release.
4. Import one of your own supported WAV recordings; save the project, confirm the download exists, reopen that downloaded file, and export a WAV. This is the remaining browser file-delivery acceptance check.
5. If mobile use matters for this prototype, inspect it in a real narrow viewport; no mobile acceptance claim is made here.

## Assumptions, limitations and actions

Determinism means the same validated project and engine in the same runtime. Reopened original asset bytes are hash-verified; arbitrary imported file metadata is not executed. Existing audio is processed through the current fixed chain. Assets and revisions are kept in memory with bounded counts but worst-case responsiveness/memory was not measured. Local recovery is one slot per browser origin; multiple editing tabs may overwrite that slot.

All modified/created files belong to this new workspace: source modules implement the approved behavior, tests check its invariants, the server/package provide local execution, and documentation/example artifacts support acceptance. No unrelated findings were implemented. No existing Lyra files were modified. No install, paid API, GPT call, Git initialization/branch/commit/push/PR, deployment, production action or external message was performed.

Implementation stops at this bounded prototype. Browser download completion, narrow-layout verification and listening remain explicitly open; this report is not a claim of full product acceptance.
