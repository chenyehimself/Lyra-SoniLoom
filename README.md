# Lyra SoniLoom · 0.4

A local, editable sound-effects workbench. Procedural synthesis, WAV decoding, processing, mixing and export are implemented in this repository. OpenAI translates descriptions into explicit edit proposals; the local engine still owns every sound and audio operation.

## Run

Requires Node.js 20 or newer and a modern desktop browser with Web Audio, module workers, IndexedDB and `structuredClone`.

```sh
git clone https://github.com/chenyehimself/Lyra-SoniLoom.git
cd Lyra-SoniLoom
npm start
```

Open **http://127.0.0.1:8795/**. No dependency installation is required. Manual editing works without API access. For optional AI editing, copy `.env.example` to `.env.local` and set your own `OPENAI_API_KEY` before starting the server. Alternatively, supply it through the server environment. Credentials are loaded only by the local server, never sent to the browser. The server binds only to loopback. Set `PORT` to use another port. Keep the terminal running while using the app.

```sh
npm test
npm run examples
```

Tests use Node's built-in runner. Example generation writes the supplied WAVs, project files and signal measurements under `outputs/`, plus the synthetic WAV import fixture under `work/`.

## Developing together

Each contributor works in their own clone, in a parent directory of their choice. Run the commands above from that clone's root. Paths in this README are relative to the repository root; no particular home directory, sibling Lyra checkout or SoundRack installation is required.

- Use a separate branch for each focused change and agree on scope with collaborators before overlapping work. Open a pull request for review rather than mixing independent changes directly into `main`.
- Keep machine-specific paths, editor preferences and API credentials local. Use your own authorized key in `.env.local` or the server environment; `.env.example` contains placeholders only. The file loader reads `OPENAI_API_KEY`, not arbitrary environment variables.
- The default port is 8795. If needed, select another port in the process environment: `PORT=8796 npm start` on macOS/Linux, or `$env:PORT=8796; npm start` in PowerShell. Use the corresponding URL. Browser settings and recovery belong to an origin, so another port has a separate recovery slot.
- Run `npm test` before proposing a change. For UI or transport changes, also exercise the affected behavior in a browser. Report automated checks, live provider checks and human listening separately; passing tests do not establish sound quality.
- Offline tests require no API key. Live AI checks are optional paid actions: agree on who runs them and the spending allowance first. Each clone has its own ignored budget ledger; the USD 5 guard is not a shared team or provider-account budget. Never reset a ledger to bypass its cap.
- Share source changes through Git and sound projects through **Save project** / **Open** when needed. Local browser recovery, conversation history, credentials and budget state are not synchronized by Git. Export only recordings and project assets you intend to share.

The file map below is a starting point for choosing an area of work, not a fixed assignment of responsibilities. Historical plans and acceptance reports describe earlier scope and evidence; coordinate new work explicitly rather than treating every roadmap item as an active task.

## Real AI conversation

Use **New sound** for an empty project, describe your sound in the left conversation and press Send. The model proposes layers and parameters. Expand the change list, then choose **Apply changes** or **Discard**. One Apply is one undoable revision. Continue speaking about the same sound; every request includes its current state, including manual edits and undo.

Choose **Selected layer** to restrict edits to that layer. **Whole sound** permits a broader proposal, but still respects locks. The computed change list is the authority for what will change; model wording can be imperfect. Check the local Applied / Not applied state. A manual change or project switch invalidates a pending proposal.

The header holds the current sound name and project actions. **Add a source** expands procedural/import/example controls. Selecting a timeline layer opens its inspector below the mix. Conversation and inspector control the same project.

AI uses `gpt-6.1-sol` with the Responses API and structured JSON output. Prompts, the last five conversation turns, layer parameters, bounded local audio measurements and asset names/IDs leave the device; original audio bytes do not. The provider cannot listen to or identify uploaded recordings in this version. `store:false` is requested; this is not a promise of zero provider retention. No external audio generation, provider tools, model training or arbitrary code execution is used.

The local live-test budget is USD 5 **across restarts**, enforced by `work/ai-budget.jsonl`. Each new Sol call permanently reserves USD 0.20; a fresh ledger admits at most 25 attempts. Existing mini calls retain their original USD 0.15 reservations and remain part of the same cumulative cap. Sol usage is estimated at USD 2 per million input tokens and USD 10 per million output tokens. Successful token usage is displayed separately as an estimate. Failed/unknown calls retain their reservation. There are no automatic retries or model fallbacks. Do not delete/reset the ledger to continue testing; increasing the budget requires a new authorization. This guard covers calls recorded in this checkout's ledger, not other clients or checkouts using the same OpenAI project. The ledger is intentionally excluded from Git; cloning creates no shared budget state. Do not run multiple copies with the same key under the assumption that their allowances are cumulative.

Provider requests are serialized, bounded to 64 KiB including schema/instructions, limited to 4,096 output tokens and timed out after 60 seconds. Charges are estimated using uncached input rates, conservatively ignoring any caching discount. The UI's ready indicator confirms server configuration; each completed response supplies actual provider evidence.

**Settings** provides Low / Medium / High reasoning effort (default Medium) and Enter or Cmd/Ctrl+Enter to send (default Enter). Shift+Enter inserts a new line. These preferences persist in this browser and apply to future requests; saving settings sends no AI request.

In the workspace, **Enter returns to the beginning and stops playback**; **Space** plays or pauses. **Cmd/Ctrl+S** saves the project, **Cmd/Ctrl+Z** undoes, and **Cmd/Ctrl+Shift+Z** redoes. Input fields and dialogs keep their own keyboard behavior; focused buttons retain native Enter/Space activation.

Chat and pending proposals are session-local and reset on New/Open/reload; project audio state is portable. Use one workbench tab while editing.

See [v0.2 criteria and plan](docs/V0.2-ACCEPTANCE.md) and [v0.2 acceptance results](outputs/v0.2/ACCEPTANCE.md).

## v0.3 spatial authoring

v0.3 introduced schema 2 / engine 0.3; v0.4 creates schema 3 / engine 0.4. Legacy schema 1 / engine 0.1 files retain their exact old rendering; use **Enable spatial authoring** in the inspector to opt in, with Undo support. Schema 2 files require v0.3; older apps will reject them.

Room controls belong to each selected layer. AI can change reflection amount, tail amount, spacing, predelay, decay and damping without changing source settings. This is an owned algorithmic effect, not measured physical-room simulation. Spatial bypass is silent; Dry includes pre-room source processing and any existing creative delay. Room tails are bounded by project length.

**Listen** isolates the dry signal, early reflections or late tail across all layers; M/S is available in Full mix mode. **Export** is independent of Listen, M/S, reference and RMS matching. Capture a reference before editing, then compare at optionally matched RMS levels.

See [v0.3 scope and criteria](docs/V0.3-ACCEPTANCE.md) and [v0.3 results](outputs/v0.3/ACCEPTANCE.md). External source acquisition is deferred; local recording editing is covered below.

## v0.4 local recording editing

Import a short WAV, select its layer and use **Original recording** to drag a source interval or enter exact **Source in / out** times. The original bytes and hash stay unchanged. Source coordinates are independent of timeline placement. **Fit clip to selection** explicitly changes clip duration; rate affects pitch and speed together, and the selected playback end controls fade-out. Reverse stays within the selected interval.

New projects use schema 3 / engine 0.4. Older projects keep their original rendering; **Enable sample editing** is an explicit, undoable upgrade. The upgrade alone is render-neutral. Applying a selection enables the new playback/fade behavior. Schema 3 files require v0.4.

AI can propose scoped source-window and fade edits using validated local duration, sample rate, channel count, peak and amplitude-position measurements. It does not receive audio or recognize the recording's content. Locks, preview/apply, undo and portable source integrity remain enforced. No cloud upload or source-separation workflow is included.

See [v0.4 criteria](docs/V0.4-ACCEPTANCE.md) and [verified results](outputs/v0.4/ACCEPTANCE.md). Verification recordings are explicitly synthetic; real-recording quality and human listening remain to be assessed with the owner.

## Manual sound editing

1. Expand **Add a source** and open the built-in **Orbital departure** example. Press Play. Start at a comfortable device volume.
2. Click **Capture reference** before changing anything.
3. Lock **Thruster release**, select **Energy buildup**, and change its duration, end frequency or cutoff. The locked layer's definition and isolated rendered audio remain unchanged.
4. Use **Listen to reference** and **Return to current** to compare. This plays the captured full mix or current audition. Stop resets the transport.
5. Undo/redo restores project edits. Use M/S for temporary mute/solo audition; these controls never change the exported full mix.
6. Import a mono/stereo WAV with **Import recording**, then change rate, reverse, placement or processing. Original WAV bytes stay in the portable project.
7. **Save project** requests a `.soniloom.json` download. **Open** validates it and verifies all asset hashes. Check the browser's downloads; a UI request is not proof that a file reached disk.
8. **Export WAV** exports the selected Export part (Full mix, Dry, Early reflections or Reverb tail). **Export layer** exports the selected layer with effects at its original timeline position and full project length. A retry link remains beneath the workspace message until another content edit or project replacement.

The project has local IndexedDB recovery. Recovery is browser/origin-specific and is not a durable backup. Undo history (up to 40 edits), audition state and A/B reference are session-only and are not included in portable files. Use one workbench tab per origin: tabs share the same recovery slot.

## Sound model and limits

- Five procedural sources: tonal body, filtered noise, mechanical pulses, rising energy and impact; plus imported WAV playback.
- Per-layer signal path: source → low-pass → saturation → DC blocker → envelope/gain/pan → stereo delay. Schema 2 adds independent algorithmic early reflections and a damped late reverb after that chain, preserving dry PCM. This version has a fixed per-layer chain, not an arbitrary routing graph. Drive at zero still applies the base saturation curve.
- Seeded, deterministic synthesis within the same engine/runtime. No random reroll on edits, hidden normalization or external audio generator. Floating-point bit equality across different JS engines is not promised.
- Final audio: 48 kHz stereo; WAV export is 16-bit PCM. Preview plays the same float render that the exporter quantizes. Device resampling/output hardware is outside this guarantee.
- Projects: 0.25–30 seconds, 16 layers, 16 source assets, 60 seconds of decoded sources in total, maximum 70 MiB portable serialization.
- Imports: WAV only, mono/stereo, 8–192 kHz, at most 30 seconds / 24 MiB each. PCM 8/16/24/32-bit and IEEE float32 supported; compressed WAV, extensible WAV, MP3 and AAC are not supported.
- Rate changes pitch and speed together; no pitch-preserving time stretch. Clips and their delays stop at project end with a short final fade. Increasing project length while any layer is locked is rejected because it could change protected delay tails.
- Meters flag samples exceeding 0 dBFS. Clipping blocks play/export until levels are reduced. There is no mastering limiter. Optional RMS matching attenuates the louder audition/reference during playback only; it does not change export audio or guarantee equal perceived loudness.
- Edits rerender in a worker. Parameter controls apply on change; this is not a realtime synthesizer or automation editor. Large assets and history consume memory; maximum-size mobile performance is unmeasured.

## Files

| Path | Responsibility |
| --- | --- |
| `src/project.mjs` | Validated project state, locks, revision generations, history and portable serialization |
| `src/wav.mjs`, `src/assets.mjs` | Owned WAV codec, content hashes and original-byte import |
| `src/sample.mjs`, `src/sample-editor.mjs` | Source bounds, local measurements and non-destructive waveform editor |
| `src/engine.mjs`, `src/render-worker.mjs` | Independent layer DSP, stereo mixing, nonblocking rendering |
| `src/app.mjs`, `index.html`, `styles.css`, `favicon.svg` | Workbench, transport, timeline, inspector, recovery and file controls |
| `server.mjs`, `server/ai.mjs`, `server/budget.mjs`, `package.json` | Local same-origin API, server-only credentials, OpenAI request boundary and durable budget |
| `src/settings.mjs`, `src/shortcuts.mjs` | Browser-local preferences, settings dialog and keyboard ownership |
| `src/ai-contract.mjs`, `src/conversation.mjs` | Validated atomic edit proposals, exact review deltas and conversation UI |
| `tests/` | State, DSP, asset integrity, export and regression checks |
| `scripts/render-examples.mjs`, `outputs/` | Reproducible examples and acceptance evidence |

The [v0.1 report](outputs/ACCEPTANCE.md) and versioned acceptance reports are historical snapshots. The [v0.4 report](outputs/v0.4/ACCEPTANCE.md) records 43 passing local tests, browser checks, provider evidence and remaining listening limitations; these are not GitHub CI results.

The repository includes source, tests, scripts, documentation, synthetic example audio, portable projects and acceptance screenshots. Local credentials, budget ledgers and work logs are excluded. Tests run offline without an API key; `scripts/live-v*.mjs` make paid requests and are not part of `npm test`. No deployment or release automation is configured.
