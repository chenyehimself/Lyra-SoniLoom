# Lyra SoniLoom · v0.6 foundation (development)

A local, editable sound-effects workbench. Procedural synthesis, WAV decoding, processing, mixing and export are implemented in this repository. OpenAI translates descriptions into explicit edit proposals; the local engine still owns every sound and audio operation.

This development branch contains the v0.5 library importer and v0.6 analysis/arrangement foundation. Package and UI version labels remain 0.5.0/0.5; this is not a published v0.6 release. Clone the branch below to obtain this work; `main` may not contain it.

The implemented architecture is one cloud planning model (`gpt-6.1-sol`) plus local analysis, retrieval and execution tools. Separate material-evaluation and arrangement skills are discussion proposals, not implemented agents. The owner found the latest pistol example unconvincing as both a gunshot and a garage scene; successful rendering does not establish sound-design quality.

## Run

Requires Node.js 20 or newer and a modern desktop browser with Web Audio, module workers, IndexedDB and `structuredClone`.

```sh
git clone --branch codex/feat-local-library-import-20261004 https://github.com/chenyehimself/Lyra-SoniLoom.git
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

- Start every update on a separate `codex/` branch from the team-agreed base, including documentation updates. Preserve any existing uncommitted work; do not reset or switch it away. Agree on scope with collaborators before overlapping work. Open a pull request for review rather than mixing independent changes directly into `main`.
- Keep machine-specific paths, editor preferences and API credentials local. Use your own authorized key in `.env.local` or the server environment; `.env.example` contains placeholders only. The file loader reads `OPENAI_API_KEY`, not arbitrary environment variables.
- The default port is 8795. If needed, select another port in the process environment: `PORT=8796 npm start` on macOS/Linux, or `$env:PORT=8796; npm start` in PowerShell. Use the corresponding URL. Browser settings and recovery belong to an origin, so another port has a separate recovery slot.
- Run `npm test` before proposing a change. For UI or transport changes, also exercise the affected behavior in a browser. Report automated checks, live provider checks and human listening separately; passing tests do not establish sound quality.
- Offline tests require no API key. Live AI checks are optional paid actions: agree on who runs them and the spending allowance first. Each clone has its own ignored budget ledger; the USD 5 guard is not a shared team or provider-account budget. Never reset a ledger to bypass its cap.
- Share source changes through Git and sound projects through **Save project** / **Open** when needed. Local browser recovery, conversation history, credentials and budget state are not synchronized by Git. Export only recordings and project assets you intend to share.

The file map below is a starting point for choosing an area of work, not a fixed assignment of responsibilities. Historical plans and acceptance reports describe earlier scope and evidence; coordinate new work explicitly rather than treating every roadmap item as an active task.

### Handoff to your Codex

After cloning the development branch, give your Codex this prompt:

> Read README.md and docs/LOCAL-API.md, inspect the current branch and working-tree status, then help me configure this clone locally. Use my own paths and ask me for the team bundle location if needed. Begin with cloud AI disabled; do not read or print secret values. Run the offline tests and check the local page and /api/status. Do not run live AI requests, reset budgets, import all audio, change feature code or perform Git writes without my approval. Explain which configuration is still missing. For a subsequent update, use a new codex/ branch after agreeing on its scope and base.

For the initial offline startup on macOS/Linux:

```sh
SONILOOM_DISABLE_AI=1 npm start
```

In PowerShell:

```powershell
$env:SONILOOM_DISABLE_AI="1"
npm start
```

For AI later, stop that process, copy `.env.example` to `.env.local`, privately enter your own authorized key, and restart without the disable flag (PowerShell: `Remove-Item Env:SONILOOM_DISABLE_AI`). The model is configured in `server/ai.mjs`, not through a model environment variable. Actual model access is only established by an authorized provider request; a configured key alone does not prove access. Do not make a paid call merely to finish setup.

A code-only clone can run and pass offline tests without the private library. To use library sounds, obtain the team's manifest and original ZIP volumes through Google Drive and follow **First-time configuration** below. Import all matching volumes if you want the entire bundle installed; importing only a manifest adds a catalog, not playable audio. No shared Drive URL or media is included in Git.

See [local API and integration map](docs/LOCAL-API.md) for routes, payload contracts and the local/cloud boundary.

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

## v0.5 local sound library

Library content is distributed separately from Git. Your team uploads the bundle to Google Drive; each user manually downloads and imports it. There is no Drive sign-in, automatic synchronization, remote library server or paid AI call in this workflow. Pulling the repository updates application code, not audio content. Ask your team for the shared Drive folder; this repository does not contain a public download link.

### First-time configuration

1. Start the local app as described above. Open **Settings → Local sound library**.
2. Keep the default `Lyra-SoniLoom-Library` folder inside your home directory, or enter an absolute path on a writable local disk. Examples: `/Users/your-name/Audio/LyraLibrary` on macOS, `/home/your-name/Audio/LyraLibrary` on Linux, or `D:\Audio\LyraLibrary` on Windows. Click **Use folder**. The displayed **Managed content** path ends in `soniloom-library-v1`; the app creates and owns that subfolder.
3. The folder setting is stored in this clone's ignored `work/library-settings.json`, independently of browser preferences and projects. Restarting preserves it. Changing the folder switches which library the app sees; it does not move or delete the previous library. Reconnect an external disk before using its library.
4. From Google Drive, download the bundle's original **manifest.json** and the individual **archives/*.zip** files you want. Keep each ZIP intact and keep its original filename. Do not import a Drive-generated wrapper ZIP. Volumes are independent; you do not need all of them. Allow free space for the compressed archive plus its expanded media and a small staging margin, in addition to any downloaded copy you keep.
5. Open **Library → Install / update bundles**, choose **Import manifest**, and select `manifest.json`. The catalog now includes assets marked **Not installed**.
6. In **Bundle version**, choose the imported version explicitly. Under **Install ZIP volumes**, choose one or more matching files. Upload and extraction progress appear below. Keep the app/server running until the job says **complete** and **Volume status** says **Installed**. Selected files install sequentially.

The existing `lyra-internal-asset-distribution` format version 1 is supported, including the initial bundle whose historical metadata says `application_installable: false`. The v0.5 adapter supplies its local installation path; you do not need to edit or repack it. SHA-256 checks establish agreement with the imported manifest, not a publisher signature. Obtain the manifest and volumes from your authorized team source.

### Browse, audition and add a recording

- Search by name, category, tag or asset ID; filter by bundle version, category, collection or **Installed only**. Results are paged. **original** and Zagon **calibrated-v01** are distinct variants. No additional calibration or normalization occurs during import.
- Select an installed recording. Its metadata shows the source identity and hash. Long recordings remain on disk. The overview samples short windows across the recording for navigation; it is not a full waveform or guaranteed transient/peak detector.
- Drag the overview or enter **In / Out** seconds. Positions are quantized to source frames; the end frame is exclusive. Choose at most 30 seconds and 24 MiB. The default selection fits the current project length. Adjust the range for high-rate recordings if needed.
- **Audition source** plays only that selection, without project filters, saturation, fades, delay or room effects. The explicit audition volume defaults to −12 dB and affects preview only. Stop or changing a selection cancels pending playback. A preview that would clip is rejected; lower its audition volume.
- Before the first insertion, accept the displayed schema 4 notice. **Add selection to project** embeds only the selected PCM frames as a WAV. It preserves source sample rate, channel count and sample precision; container metadata is not copied. The new layer uses the existing project processing chain, so project playback can differ from raw audition. Its duration fits within the current project length; shorten the source selection if you want every embedded frame to play.
- The project keeps bundle ID/version, semantic asset ID, variant, original source hash, selected frame range and embedded hash on each layer. Identical audio may share embedded bytes while retaining distinct layer identities. The inspector shows provenance; the saved JSON contains the complete reference.
- **Save project** embeds the selected audio. **Open**, editing and rendering then work without the installed library or Drive. Projects are limited to 16 layers/assets, 60 seconds of total embedded sources and 70 MiB serialized size. A rejected insertion leaves the project unchanged.

MIDI and multichannel recordings remain visible in the catalog but cannot be auditioned or added. The current decoder supports mono/stereo PCM 8/16/24/32-bit and IEEE float32 WAV at 8–192 kHz. Compressed/extensible WAV and other formats are unsupported. Device playback may resample; source bytes in the project are preserved. AI does not browse or choose library assets in v0.5. Existing AI edits can operate on embedded sample layers; library paths, full catalog and audio are not sent to the provider.

### Updates and compatibility

Import the next version's manifest, select that version and import the volumes you need. Versions coexist on disk. An unchanged manifest import is a no-op; already installed matching volumes are skipped. Different content under the same bundle ID/version is rejected as a conflict: the publisher must assign a new version. Updates never relink or replace an older project's embedded audio. There is no automatic update notification, uninstall or garbage collection UI in this version.

New empty projects still use schema 3 / DSP engine 0.4. Library insertion upgrades to schema 4 / the same DSP engine 0.4 in one undoable revision. Existing layers retain their rendering; **Undo** restores both the insertion and previous format. Older application versions reject schema 4, so collaborators opening these projects need v0.5. Direct WAV import and older projects continue to work as before.

### Troubleshooting

| Symptom | Action |
| --- | --- |
| Library is empty after Git pull | Download the separate team bundle and import its manifest and ZIP volumes. Git does not distribute the library. |
| Not installed | Inspect the asset's required ZIP filename, select the correct bundle version, and install that volume. |
| Filename, size or SHA-256 mismatch | Download the original individual volume again. Do not rename it, extract it first, or edit the manifest to bypass verification. |
| Same-version conflict | Obtain a newly versioned manifest from the publisher. Existing content remains unchanged. |
| Permission denied / folder unavailable | Choose a writable absolute local folder; check disk mount and OS access. The app does not elevate privileges. |
| Not enough disk space | Choose a disk with room for both staging and extracted content. Existing volumes are retained. |
| Cancelled, failed or interrupted import | Re-select that ZIP to restart from the beginning. Incomplete volumes are never published. Cancel affects only the active volume; previously completed volumes remain. After a process crash, an ignored `.staging-*` directory may occupy space under the bundle version; with the server stopped, remove only that incomplete staging directory if needed. There is no resumable download or import. |
| Library file missing | Reconnect the configured disk or restore its managed content. Do not edit or move files inside an installed volume; hashes are checked during installation, not continuously monitored afterward. A portable project with embedded audio does not need these files. |
| Selection too large / project limit reached | Shorten In / Out or remove unneeded source layers. Long source files remain available on disk. |
| Unsupported format / channels | Keep the entry as a catalog reference. This version performs no automatic conversion or downmix. |
| Local service unavailable | Keep `npm start` running, use its exact loopback URL, and reopen the page after a restart. Folder settings do not require an API key. |

Use one local server per library folder. Changing roots and importing manifests are blocked during an installation. ZIP upload, inflation and hash verification stream through bounded buffers; only the selected audio range is read into memory for audition/insertion. Bundles, installed content, credentials and machine-local configuration must stay out of Git. Store a custom library outside the checkout; the repository's existing `work/` area is ignored for local bundle preparation.

## v0.6 foundation — local analysis and library proposals (development)

This local development extension uses **existing bundle labels**, not an audio recognition model, to find sounds. Original media and published bundle manifests are unchanged. Processing still uses the existing fixed DSP chain; there is no new processing graph, general-purpose EQ or audio semantic model.

### Start without cloud AI

1. Configure and install your library using the steps above. No new dependency or model download is needed.
2. Open **Library → Local analysis & candidate search**. Select a supported installed recording and click **Analyze selected**, or use **Analyze this page · first 20** for a bounded batch.
3. **Refresh status** shows progress and the selected source's measurements. **Cancel analysis** stops the batch; **Resume analysis** resumes incomplete files after cancellation, partial failure or a server restart. Completed files keep their results. Resolve a disk/permission problem before resuming. A source file interrupted halfway is restarted from its beginning.
4. **Rebuild index** recreates the lookup index from catalog entries and completed records; it does not scan audio. Original names and tags remain catalog metadata.
5. Enter bundle keywords such as `pistol`, `metal door` or `rain`, then click **Find candidates locally**. This searches across the installed library, independently of the ordinary browse filters. All query terms must match catalog words/prefixes; this is lexical retrieval, not multilingual semantic search. No match means no substitution.
6. Inspect candidate intervals, then click **Prepare editable preview**. A detached proposal appears in Conversation with source-frame evidence, a WAV preview and exact changes. The current project remains unchanged. Accept the schema 4 notice if present and click **Apply changes**, or **Discard**. Undo restores the previous project in one step.

Peak/RMS and band-energy estimates describe the entire source, not necessarily the selected clip. Energy-event boundaries are approximate; they do not prove that an event is a gunshot or that background noise is absent. Long continuous sounds may be shortened to fit import limits; inspect the displayed range. A preview that clips is rejected without applying changes. For a local candidate, use the existing manual library controls to choose a different range or level if necessary.

The scheduler accepts one batch at a time, with at most 20 files. Each search considers at most five matching sources and two candidate intervals per source. Automatic fresh measurement is limited to sources no longer than 60 seconds and 120 seconds combined per search. Longer sources remain label-only candidates until you explicitly analyze them. No full-library scan starts automatically on import or startup. Analysis yields between read chunks, but there is no cross-process render-priority scheduler; cancel a batch if your machine becomes busy.

### Optional cloud arrangement

Configure your existing API key as described above. In Conversation, check **Use library candidates** to permit the new workflow. This checkbox is session-local and off after reload. It allows OpenAI to receive your request, recent conversation/project context, and a bounded set of temporary candidate IDs, categories/tags, interval durations and numerical measurement summaries. Candidate audio, full catalog, source hashes/provenance, original filenames and disk paths are not included in the candidate payload. Existing project asset names remain part of the normal project context.

The model may request **at most three retrieval rounds including the first**, then propose supported edits or explain why suitable material is missing. A complete request may require up to four provider calls. Each call uses the existing durable budget reservation; a three-round search limit is not a separate spending allowance. There is no automatic retry or model fallback. Selected-layer scope cannot search for or add new sources. For parameter-only follow-ups, the model can propose edits immediately without searching.

Review the source evidence, retrieval trace and exact edit list before Apply. The model reasons from catalog labels and measurements; it has not listened. **Cancel request** aborts outstanding work; already submitted provider requests may still cost money and their reservations are retained. A manual project edit, new project, or library-root change invalidates relevant pending proposals. Preview, Apply and Undo are local operations and make no paid call.

For a session in which cloud calls must be impossible, start the local server with `SONILOOM_DISABLE_AI=1 npm start` (or set that environment variable in your shell). The server ignores configured keys for that process. Manual editing, local candidate search and preview remain available. Tests simulate provider responses; they do not need a real key or spend the live ledger.

### Storage, identity and compatibility

Derived JSON files live under `<configured library folder>/soniloom-library-v1/analysis-v1/`: versioned `records/`, per-file checkpointed `jobs/`, and a rebuildable `index.json`. Keep them local and outside Git. There is no analysis-pack distribution or new annotation editor. Completed signal analysis can be reused by distinct catalog entries with identical bytes; calibrated variants with different bytes receive distinct records. Source hashes are checked during analysis/reuse and before candidate extraction. A changed source is rejected rather than silently relinked.

Active analysis batches block changing the library folder until finished or cancelled. Resume is explicit. Candidate sessions expire after 20 minutes and are invalidated by root/catalog changes; fully embedded projects no longer depend on the library. Use one local server per library root.

Schema 1/2 projects must explicitly use the existing **Enable sample editing** action before this proposal workflow can insert library sources. This avoids a silent legacy-engine upgrade. Schema 3 projects show a schema 4 acceptance checkbox before Apply. No new project schema or DSP version is introduced. Save/Open retains original-source provenance and embedded selected WAV bytes; detailed analysis and conversation history are not embedded in the project.

Known evidence limits: real-provider validation on 2026-10-05 exposed overconstrained keyword searches; the planner now receives the explicit all-terms search contract and zero-result broadening guidance. A real provider successfully arranged a locally seeded candidate shortlist, and its saved project passed render/Undo/Redo/roundtrip checks. The complete automatic search flow after that repair and a real-provider room-only follow-up remain unverified because the authorized session allowance was exhausted. Browser checks establish interaction and playback, not human judgments of realism. The owner subsequently reported that the example did not sound convincingly like a gunshot or convey a garage space. Positive listening acceptance and broad relevance evaluation remain outstanding. See [v0.6 engineering design](docs/V0.6-ENGINEERING-DESIGN.md) for the approved boundary and deferred architecture.

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
| `src/library.mjs`, `src/library-contract.mjs` | Library UI, distribution adapter and layer source references |
| `server/library.mjs`, `server/library-http.mjs`, `server/library-zip.mjs`, `server/library-audio.mjs` | Local catalog, atomic volume installer, bounded ZIP reads and source-frame extraction |
| `src/settings.mjs`, `src/shortcuts.mjs` | Browser-local preferences, settings dialog and keyboard ownership |
| `src/ai-contract.mjs`, `src/conversation.mjs` | Validated atomic edit proposals, exact review deltas and conversation UI |
| `server/audio-analysis.mjs`, `server/analysis-store.mjs`, `server/library-search.mjs` | Local measurements, resumable jobs, index and bounded candidate retrieval |
| `server/arrangement.mjs`, `src/library-ai-contract.mjs`, `src/arrangement.mjs`, `src/library-intelligence.mjs` | Cloud search coordination, summary contract, detached preview and local analysis UI |
| `tests/` | State, DSP, asset integrity, export and regression checks |
| `scripts/render-examples.mjs`, `outputs/` | Reproducible examples and acceptance evidence |

The [v0.1 report](outputs/ACCEPTANCE.md) and versioned acceptance reports are historical snapshots. The [v0.4 report](outputs/v0.4/ACCEPTANCE.md) records 43 passing local tests, browser checks, provider evidence and remaining listening limitations; these are not GitHub CI results.

The repository includes source, tests, scripts, documentation, synthetic example audio, portable projects and acceptance screenshots. Local credentials, budget ledgers and work logs are excluded. Tests run offline without an API key; `scripts/live-v*.mjs` make paid requests and are not part of `npm test`. No deployment or release automation is configured.
