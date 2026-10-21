# Local API and integration map

This documents the current development implementation, not a stable external SDK. All endpoints belong to the local Node server. No Lyra server, Drive API, cloud audio upload or new agent framework is required. The browser renders audio locally; a successful planning response does not apply a project revision or prove sound quality.

The Luna → Sol conversation route is implemented with simulated-model acceptance. See [the design](AGENT-INTENT-AND-PLANNING-DESIGN.md). Real dispatch remains disabled until both role billing policies are verified; `VERIFIED_MODEL_POLICIES` is intentionally empty.

## Configuration and access

- Node.js >=20; no npm dependencies to install. Run `npm start` from the clone root.
- `PORT`: process environment only, default `8795`. Server binds to `127.0.0.1`.
- `OPENAI_API_KEY`: process environment first, then `.env.local`. Never expose its value to the browser, logs, commits or Codex messages.
- `SONILOOM_DISABLE_AI=1`: process environment only; disables provider access even if a key exists.
- Legacy model and reasoning configuration: `server/ai.mjs`; model currently `gpt-6.1-sol`, reasoning `low`, `medium` or `high`. No model environment override exists.
- Library path: Settings → Local sound library; persisted in ignored `work/library-settings.json`. Keep content outside Git.
- Paid-call reservations: ignored `work/ai-budget.jsonl`, local to each clone. See README for limits. Never erase it to regain allowance.

`GET /api/status` returns configuration/model/budget status and a process-local `clientToken`. Do not publish the token. AI POST requests require exact `Content-Type: application/json`, `X-SoniLoom-Token: <clientToken>` and the same-origin `Origin` header. Library requests all require that token; non-GET/HEAD library requests also require the same origin. Use the running app's origin and port. Restarting the server changes the token. This interface is intended for the loopback application, not remote hosting.

## AI routes

| Route | Input / result |
| --- | --- |
| `POST /api/agent-turn` | Intent/context request below → clarification, discussion, cancelled, unavailable or proposal; current conversation route |
| `POST /api/propose` | Validated request below → proposal plus provider/budget metadata; can incur charges |
| `POST /api/arrange` | Same request plus `librarySummaryConsent: true` → proposal, reason, unavailable flag, sessionId, candidates, retrieval trace, call count and provider/budget metadata; can incur multiple charges |

For the legacy routes, the request fields are `prompt`, `project`, `scope`, `history` and optional `reasoningEffort`. Build `project` using `projectContext()` from `src/ai-contract.mjs`; **do not send a saved project or embedded WAV data**. `scope` is `all` or an existing layer ID. `history` contains `{role, content}` entries. `normalizeRequest()` in `server/ai.mjs` is the authoritative validator. The browser supplies recent bounded history. HTTP AI bodies are limited to 100 KiB; provider payloads have a separate 64 KiB limit.

A proposal is `{message, operations}`. Each operation has `kind`, `layerId`, `source`, and `changes: [{field, value}]`. The permitted kinds are `add`, `edit`, `remove`, `project`; source types and parameter allowlists come from `PROPOSAL_SCHEMA` and `EDIT_FIELDS` in `src/ai-contract.mjs`. Do not invent EQ/routing operations absent from that contract.

Legacy library planning uses `search`, `arrange` and `unavailable` decisions defined in `src/library-ai-contract.mjs`. The same model is called at most four times, with at most three local retrieval rounds. Selected-layer scope cannot search or add sources. Candidates are temporary handles, not persistent asset IDs. Cloud candidate summaries include display names (200 characters), embedded descriptions (600 characters), matched metadata fields, labels and measurements. They exclude audio, source-path fields and full provenance; normal project context still includes asset names. Catalog text is evidence supplied by the bundle, not acoustic recognition.

`src/arrangement.mjs` materializes chosen clips and prepares a detached proposal. The browser renders its preview; `prepareProposal()` / `applyProposal()` enforce validation, locks, stale-generation checks and atomic history. Callers must preserve the existing schema acceptance and Apply/Discard flow. The server does not own the editable browser project.

## Library routes

All paths below have the prefix `/api/library/`. JSON responses use HTTP 200 on success; validation/operation failures generally return 422 with `{error}`. Unauthorized access returns 403 and unknown library routes return 404. WAV responses instead contain bytes and `X-SoniLoom-Source` JSON provenance.

| Method / suffix | Body or behavior |
| --- | --- |
| `GET settings` | Configured folder, managed folder and installation activity |
| `POST settings` | `{folder}`: absolute local directory; blocked during active analysis/install |
| `GET catalog` | `{bundles, entries}` including installation state |
| `POST manifest` | Full distribution-v1 manifest JSON; max 20 MiB, validated by `src/library-contract.mjs` |
| `POST jobs` | `{bundleId, version, archive}`; archive is the manifest's exact archive path; returns an install job |
| `GET jobs` | `{jobs}`: current process's installation jobs |
| `PUT jobs/:id` | Raw original ZIP bytes, streamed; not JSON or multipart |
| `POST jobs/:id/cancel` | Cancel the active installation job |
| `POST overview` | Asset reference → sparse navigation overview, not full-file analysis |
| `POST clip` | Asset reference plus `firstFrame`, `endFrame` → selected WAV bytes and source provenance |
| `POST analysis/jobs` | `{refs: [assetReference, ...]}`; at most 20 files |
| `GET analysis/jobs` | Persisted analysis job status |
| `POST analysis/jobs/:id/cancel` | Cancel analysis batch |
| `POST analysis/jobs/:id/resume` | Explicitly resume incomplete files |
| `POST analysis/record` | Asset reference → cached analysis result or `{record: null}` |
| `POST analysis/rebuild` | Rebuild derived index; returns snapshotId, total and ready counts; does not scan audio |
| `POST search/start` | Start session; returns `{id, snapshotId}` |
| `POST search` | `{sessionId, query}` → candidates, round, totalMatches, truncation and warnings |
| `POST search/clip` | `{sessionId, candidateId}` → verified selected WAV bytes and source provenance |

An asset reference is `{bundleId, version, assetId, variant}` copied from a catalog entry. Do not interchange transport `version` and persisted project provenance `bundleVersion`. Frame ranges are zero-based with an exclusive end. Use exact catalog identities, not guessed filenames.

Retrieval reads the current catalog in memory and requires all query terms to match name/category/tag/embedded-description words or prefixes; there is no semantic expansion or negation syntax. Start with one or two source keywords such as `pistol`, not a full scene description. No matches should prompt removing terms, not adding synonyms. Distinct normalized titles are promoted before additional takes of the same title. Sol may broaden within the relevant sound family while preserving the requested event and explicit identity constraints, and must explain substitutions and uncertainty. Each search considers five sources and up to two heuristic intervals per source. Automatic analysis is limited to sources <=60 seconds and <=120 combined seconds per search. Sessions expire after 20 minutes and are invalidated by library-root/catalog changes. Recreate them after server restart.

Extraction retains current limits: supported mono/stereo WAV, <=30 seconds and 24 MiB per clip. Analysis measurements describe the whole source, not necessarily the extracted interval. A candidate is not proof of semantic identity, correct event boundaries or audible suitability.

## Ownership and extension points

| Responsibility | Source |
| --- | --- |
| HTTP guards and route dispatch | `server.mjs`, `server/library-http.mjs` |
| Catalog, installation and source lookup | `server/library.mjs`, `server/library-zip.mjs`, `server/library-audio.mjs` |
| Local measurement and derived records/jobs | `server/audio-analysis.mjs`, `server/analysis-store.mjs` |
| Catalog evidence ranking and candidate sessions | `server/library-search.mjs` |
| Provider contract and bounded orchestration | `server/ai.mjs`, `src/library-ai-contract.mjs`, `server/arrangement.mjs` |
| Preview, revision validation and local application | `src/arrangement.mjs`, `src/ai-contract.mjs`, `src/project.mjs`, `src/conversation.mjs` |
| Analysis/search UI | `src/library-intelligence.mjs` |
| Owned audio rendering | `src/engine.mjs`, `src/spatial.mjs`, `src/render-worker.mjs` |

Derived records live under the managed library's `analysis-v1/` directory. They are local cache/job data, not a new distributable bundle or project schema. See `docs/V0.6-ENGINEERING-DESIGN.md` for proposals explicitly outside the implemented foundation.

## Verification without paid calls

Run `npm test`, then start with `SONILOOM_DISABLE_AI=1` and check the page and `/api/status` (`configured` must be false). Library integration needs separately installed team content. Offline tests use fixtures and simulated providers; they do not verify actual model access or listening quality. Do not call `/api/propose` or `/api/arrange` against an AI-enabled server as a setup probe.

## Coordinated conversation contract

`POST /api/agent-turn` accepts `{requestId, prompt, context, librarySummaryConsent, reasoningEffort}`. Build `context` with `createAgentContext()` in `src/agent-context.mjs`; it contains a project/session/revision anchor, scope, current project facts and bounded turn/reference records. Never send saved audio. `requestId` is unique within the session; repeated IDs are rejected, including after a failed request, until server restart. This replay guard is process-local, not a persistent idempotency API.

Results carry `kind`, `message`, `requestId`, `anchor`, `intentRecord`, `calls: {luna, sol, search}`, `usage` and budget status. Proposal results additionally carry `proposal` and optional candidate/session/trace evidence. Only proposal results enter preview/Apply. Clarification waits for another user submission, with no fixed conversation-round limit. Sol receives original wording, current authoritative facts, interpreted intent, remaining counters and previous search feedback, including zero matches.

Per submission: Luna <=3, Sol <=3, local retrieval <=3; sequential execution performs at most two searches before the final Sol decision. Selected-layer scope cannot search/add. `revise_sound` only permits edits/removals of resolved targets. Cancellation or stale project state prevents local application. Local Apply/Undo does not invoke models. All three HTTP AI routes share a busy guard.

`GET /api/status` retains legacy fields and adds `agent` with configured status, role models and disabled reason. Check `agent.configured` for Conversation. Dispatch uses `server/agent-runtime.mjs`, `server/agent-turn.mjs`, `server/model-provider.mjs` and `server/model-policy.mjs`. Missing verified billing policy fails closed before reservation/fetch; a key alone is insufficient. Ledger version-2 role reservations share the existing USD 5 cap and preserve historical records. No real role prices are supplied in this mock-accepted implementation.

## Application skill loading

`server/skills.mjs` synchronously loads fixed English role bundles at initialization, with no request-controlled paths or dynamic installation. Luna receives the intent skill; Sol receives the planning skill and three references. Files are cached until restart; missing/empty required content fails closed. Scenario examples are not in provider payloads. The HTTP contracts, paid-call guards and response schemas remain unchanged. Route-specific instructions supply the distinct legacy and coordinated action/call limits. See README for locations and evidence limitations.
