# Lyra SoniLoom v0.2 — Acceptance results

Date: 2026-10-02 (America/New_York). Delivery: local AI-assisted sound workbench ready for owner acceptance. Human listening and actual browser download completion remain separate, unverified items.

## Approved objective and scope

Real AI text conversation for creating and precisely modifying owned-DSP sound projects; SoundRack-inspired conversation/header/editor layout; USD 5 maximum live test budget. Only the SoniLoom workspace changed. Existing SoundRack HTML/CSS were inspected read-only. No model training, external audio generator, changes to other Lyra projects, dependency installation, Git action, deployment, billing change or external messaging.

## Criteria results

| Criterion | Evidence and result |
| --- | --- |
| Real sound creation | PASS: actual `gpt-5.4-mini-2026-03-17` generated a six-second, three-layer spaceship proposal; own DSP rendered it. Browser also generated a two-second, three-layer magic pickup from Chinese text and applied it. |
| Three sequential edits | PASS: three real follow-ups changed only one existing layer's cutoff to 1800 Hz, end frequency to 600 Hz, then gain to 0.12. Same project and stable layer IDs across turns. |
| Scope, locks, stale state | PASS: automated scope/lock/atomicity checks; protected layer PCM bit-identical across the live sequence. Browser request followed by locking the layer produced an explicit stale-result rejection; gain stayed 0.22 rather than proposed 0.10, inspector remained disabled. Failed proposals suppress model explanation so misleading past-tense wording does not masquerade as an applied change. |
| Review and history | PASS: computed exact delta list before Apply; one Apply creates one revision. Browser cutoff 2800 → 2500 → Undo 2800 → Redo 2500. Sample-add review includes original asset name and hash. Invalid/no-op proposals do not create partial changes. |
| Owned render and persistence | PASS at test/artifact level: imported original WAV bytes preserved after AI parameter edit. Before/after saved AI project files reopened and rendered; encoded WAVs match supplied files byte-for-byte, 288,000 frames, stereo 48 kHz, zero clipped samples. Browser download completion remains unverified (see below). |
| UI | PASS in observed views: compact current-sound title and file actions, left conversation/composer, right timeline/mix, expandable sources/inspector. Desktop 1280×720 and 1440×900; narrow 390×844 with viewport/document width both 390. Real proposal Apply exercised at narrow width. No relevant captured console warnings/errors. |
| Credentials and budget | PASS: key stays in server environment/local file; no audio bytes in provider payload; same-origin token/Origin/Host gate; private paths excluded; bounded requests and durable reserves; no automatic retries. Eight live calls, all with reported token usage. |

## Costs and provider evidence

- Eight actual provider calls: four scripted creation/refinement turns, one browser scoped edit, one browser generation, two browser stale-result tests.
- Token-based estimated cost: **USD 0.020547**. This is an estimate, not an invoice or account billing verification; uncached input rates conservatively ignore caching discounts.
- Conservative permanent reservations: **USD 1.20**; remaining local allowance **USD 3.80**. Each attempted request reserves USD 0.15, including failures/unknown outcomes. Maximum 33 attempts under the USD 5 cap.
- No uncertain unsettled requests at handoff. The ledger persists at `work/ai-budget.jsonl`; do not reset it to bypass the cap.
- Payload <=64 KiB, maximum output 4096 tokens, fixed model, no provider tools or automatic retries, one concurrent request. `store:false` requested; not a zero-retention claim.
- Official references checked: [model and pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [structured output](https://developers.openai.com/api/docs/guides/structured-outputs). Published rates used: USD 0.75 input / USD 4.50 output per million tokens.
- `provider-evidence.json` records the first four request descriptions, exact structured replies, response IDs, usage and local computed deltas. No secrets/audio bytes are in this evidence.

## Tests and independent review

`npm test`: **26 passed, 0 failed**. Covers original DSP/project/WAV invariants plus atomic proposals, exact scope, locks, stale store/generation, local identity creation, no-op, invalid final operation, metadata-only payloads, imported byte preservation, sample identity disclosure, retained unreferenced assets, budget persistence/exhaustion/corruption, provider failure/incomplete/malformed responses, missing key, invalid scope and concurrent requests.

One independent read-only review found two in-scope issues. Both were reproduced with failing tests then fixed: sample-add deltas omitted asset identity; scoped edits pruned preexisting unreferenced WAV assets. Final full suite passed after fixes. No deferred minor findings. The reviewer did not independently listen or perform browser/provider testing.

Local HTTP checks: four private paths returned 404 (`.env.local`, server-only AI module, budget ledger, parent-path attempt); missing-token and foreign-Origin requests returned 403; malformed authorized-context request returned 422. Request count did not increase. Browser's play/stop controls and rendered PCM were exercised, which does not prove physical speaker output.

## Changed files and why

| Files | Purpose |
| --- | --- |
| `src/ai-contract.mjs` | Exact operation vocabulary, metadata projection, local proposal validation, computed review deltas, atomic apply and freshness |
| `server/ai.mjs`, `server/budget.mjs`, `server.mjs` | Server-only OpenAI boundary and credentials, safe local routes, fixed model, durable conservative cap |
| `src/conversation.mjs`, `src/app.mjs` | Stateful conversation, Apply/Discard, context reset/invalidation, integration with the same project/undo path |
| `index.html`, `styles.css`, `package.json` | v0.2 SoundRack-inspired information hierarchy and version |
| `tests/ai-contract.test.mjs`, `tests/ai-server.test.mjs` | Focused invariants and failure regressions; no paid calls in `npm test` |
| `scripts/live-v02.mjs`, `outputs/v0.2/` | Explicit paid acceptance runner, real response/audio/project evidence and screenshots |
| `README.md`, `docs/V0.2-ACCEPTANCE.md`, `work/progress.md` | Requested criteria, plan, usage/limits and execution record |

The original engine, WAV codec and persistent project schema were preserved. `.env.local` was read, not modified.

## Design reference and intentional differences

Reference: current SoundRack `index.html` and `plugin-shell.css`, especially current-patch identity, side conversation, readable turn blocks and composer. SoniLoom retains its sound-effect timeline instead of instrument-performance controls. Sources and detailed processing are expandable, reducing the three competing columns from v0.1. No SoundRack navigation/history features were copied as inactive controls.

## Evidence files

- `ai-before.wav`, `ai-after.wav`: real-AI-designed spaceship before/after the scoped refinement sequence.
- `ai-before.soniloom.json`, `ai-after.soniloom.json`: editable source projects.
- `audio-and-budget-evidence.json`: fresh persisted artifact verification and final budget snapshot.
- `desktop.png`: final desktop workspace with the generated magic pickup.
- `mobile.png`: actual 390-pixel layout after successful proposal application.
- `rejected-stale.png`: final browser rejection with unchanged protected audio.

## Limitations and owner acceptance

1. **Listening pending.** No claim about realism, artistic quality, speakers or perceptual similarity. Start at a comfortable volume and listen to supplied WAVs.
2. **Browser download completion pending.** Codex in-app browser download event timed out after 8 seconds. Named Blob download links were produced; disk completion could not be verified. Scripted exports and project roundtrips passed independently. Confirm Save/Open/Export in your normal browser before relying on download delivery.
3. **Semantic precision is bounded.** Code enforces operation types, numerical validity, locks, selected-layer scope and atomicity. It does not formally prove that every parameter choice matches natural-language intent. Review computed deltas before Apply. Broad requests may need clarification; supported source vocabulary is still the v0.1 fixed DSP chain.
4. Chat is session-local; reload/Open/New clears it. Audio project state persists and can be saved independently. No arbitrary routing graph or new acoustic-model fidelity claim.
5. AI sees prompts, recent chat, settings and asset names/IDs, but cannot listen to imported recordings. It may use imperfect wording; local application status is authoritative.
6. Desktop/narrow checks cover the stated browser/flows, not a full cross-browser or accessibility certification. Worst-case latency/memory and account billing were not measured.
7. The USD 5 guard only covers calls made through this application. Other clients on the shared `lyra-dev` project are outside its control. A ready indicator means configured, not that every future model request will succeed.

## Decisions made within scope

- Explicit Apply separates suggestions from edits. Cost: an additional click; benefit: reviewable exact changes and safe undo.
- Fixed per-layer chain and session-only chat preserve the existing portable schema. Cost: chat is not portable and graph routing is not added.
- No Git skill helpers or commits were used because Git actions were excluded. Work remains directly inspectable in the local workspace.

Stop at this v0.2 scope. Remaining download/listening checks are honestly identified, not represented as passed or used to expand implementation.
