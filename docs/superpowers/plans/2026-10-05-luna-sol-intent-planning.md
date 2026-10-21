# Luna Intent and Sol Professional Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for sequential implementation, or `superpowers:subagent-driven-development` if the owner selects delegation. Steps use checkbox syntax. This file is a proposal for review, not permission to execute, commit or push.

**Goal:** Build one SoniLoom Agent that uses GPT-6 Luna to understand project/session-scoped intent and GPT-6.1 Sol for all professional sound decisions, with deterministic local execution.

**Architecture:** A local coordinator owns request identity, model/tool limits and transitions. Luna returns a structured intent or a clarification question; Sol receives the original wording, validated intent, current project facts and bounded local evidence. Existing preview, Apply, Undo and source integrity remain the execution boundary.

**Tech Stack:** Node.js >=20, native ES modules, browser DOM/Web Audio and existing render worker, Node's built-in test runner. No new production dependency, model runtime or agent framework.

**Spec:** [Intent, Context and Professional Planning](../../AGENT-INTENT-AND-PLANNING-DESIGN.md). Read both documents before implementing.

## Authority and baseline

This plan was prepared by static inspection on 2026-10-05. Code baseline is `140fc0c`; the design and its README/API links are uncommitted on `codex/docs-luna-sol-context-design-20261005`. Preserve all existing documentation changes. The previous 95-test result is historical evidence, not a new run for this plan.

Only this plan file is added by the present task. No product code, schema, API, settings, budget ledger, source audio or dependency changes occur now. No paid requests or runtime tests occur now. Do not create a new permanent process from this plan.

Future implementation starts on a separately approved `codex/` implementation branch from the reviewed baseline, preserving these uncommitted docs. Do not stash/reset/discard them. Confirm the actual branch and dirty state first; branch creation, commits and pushes require their own authorization. The user's approval of a plan is not authorization to publish it.

## Global constraints

- One product Agent; Luna is `gpt-6-luna`, Sol is `gpt-6.1-sol`.
- Luna understands language/context; Sol owns every professional source, retrieval and DSP decision.
- Audio bytes, waveform computation, DSP and rendering remain local. Neither model is represented as having listened.
- Memory stays in the current project/session; no persistent memory, cross-project profile or project-schema addition.
- Luna decides when it needs clarification; no cap on user-facing clarification rounds.
- Each user-submitted execution attempt: Luna <=3 calls, Sol <=3 calls, local retrieval <=3 rounds. Internal continuation/failure never resets counters.
- Model calls are ceilings, not targets. No automatic paid technical retries or fallback model.
- No new dollar estimate or spending authorization. Preserve existing ledger reservations and cap.
- No free DSP graph, new effects, audio semantic model, bundle changes or Lyra runtime dependency.
- Preserve selected-layer scope, locks, explicit schema upgrade, detached preview and atomic Apply/Undo.
- New contracts, output limits and UI details below are proposed implementation decisions requiring review, not current capabilities.

## Delivery boundaries

**A — Intent/context foundation:** Tasks 1–3. Pure contracts, session state and a Luna service tested with injected simulated responses. No application route or paid dispatch is enabled. This yields a usable, tested internal interface, not a claim that the visible app now uses Luna.

**B — Coordinated application workflow:** Tasks 4–6. Connect model roles, clarification UI and professional planning. This depends on an approved multi-model budgeting policy and explicit API-contract approval. Can be verified with fake providers and an AI-disabled server; real-provider verification remains deferred.

**C — Selected-clip evidence:** Task 7. Improve professional evidence independently after A/B contracts are settled. Does not add semantic recognition or guarantee better sound.

The recommended first implementation approval is A only. B and C remain subsequent reviewable scopes; completing A does not authorize them. For each approved stage, stop once its listed checks pass and report the exact evidence level. Do not silently deliver A as a completed Luna/Sol product workflow.

## Review focus

1. “That one” with two equally plausible sources must ask, never pick by name coincidence (Tasks 1, 3, 6).
2. An unanswered question must survive more than three user replies without carrying stale project identity (Tasks 2, 6).
3. Undo/manual edits during a request must not convert an unapplied proposal into current facts (Tasks 2, 5, 6).
4. Provider failure or search exhaustion must not open an extra model call or reset money reservations (Tasks 4, 5).
5. A short selected transient must not inherit RMS or tail properties from a long source file (Task 7).

## File map

| Stage | Create | Modify only for the stated purpose |
| --- | --- | --- |
| A | `src/intent-contract.mjs`, `src/agent-context.mjs`, `server/intent.mjs`; focused tests | No production route, existing settings or budget changes |
| B | `server/agent-turn.mjs`, `server/model-policy.mjs`, `src/planning-contract.mjs`; focused tests | `server/ai.mjs`, `server/budget.mjs`, `server/arrangement.mjs`, `server.mjs`, `src/library-ai-contract.mjs`, `src/conversation.mjs`, `src/settings.mjs`; docs after behavior exists |
| C | `server/clip-analysis.mjs`, `tests/clip-analysis.test.mjs` | `server/library-search.mjs`, `src/library-ai-contract.mjs` to supply scoped clip evidence |

Reuse `src/ai-contract.mjs`, `src/arrangement.mjs`, `src/project.mjs` and the renderer as authoritative dependencies. Do not rewrite these modules for consistency. Any new mutation behavior in them requires an explicit, demonstrated need within the approved phase.

## Proposed shared contracts

Use strict validators and reject unknown fields. Model output never chooses local project/session/request identity.

- `Anchor`: `{sessionId, projectId, generation}`. Local IDs are nonempty strings; generation is a nonnegative safe integer.
- `ContextEnvelope`: `{anchor, scope, selectedLayerId, projectFacts, turns, corrections, pendingClarification}`. `projectFacts` comes from existing `projectContext(project)`; scope is `all` or an existing layer ID. Each turn has local ID, user text, assistant text, and a typed outcome (`clarification`, `proposed`, `applied`, `discarded`, `outdated`, `failed`, `cancelled`). Applied history is not a claim that its result is still current after Undo.
- `IntentDecision`: `{status, intentKind, requestedOutcome, targetLayerIds, preserve, evidenceTurnIds, unknowns, assumptions, question}`. Status is `ready` or `needs_clarification`; intent kind is `new_sound`, `revise_sound`, `discuss`, `clarify` or `cancel`. `preserve` contains `{targetId, requirement, evidenceTurnIds}`; requirement remains user-language meaning, not a model-invented parameter map.
- `IntentRecord`: local wrapper `{requestId, anchor, originalText, decision}`. Only local code attaches identity and verbatim text after validation.
- `AttemptCounters`: `{lunaCalls, solCalls, retrievalRounds}`. The coordinator increments before dispatch; failed submitted attempts count. No model output can set counters.
- Future `TurnResult`: tagged union `clarification`, `proposal`, `unavailable`, `discussion`, `cancelled`. Includes request/anchor identity, stage usage and counters. Only a proposal has existing validated edit operations; none directly mutates a project.

Proposed text limits: prompt 3,000 characters, question 1,000, outcome 3,000; at most 16 targets/preservation entries and 12 unknowns/assumptions, each <=500 characters. These are transport limits, not limits on clarification rounds. Retain the existing 100 KiB HTTP and 64 KiB provider body limits; oversize context fails before dispatch rather than silently dropping preservation evidence.

## Task 1: Intent boundary and validation (A)

**Files:** Create `src/intent-contract.mjs`, `tests/intent-contract.test.mjs`.

**Interfaces:** Export `INTENT_DECISION_SCHEMA`, `validateIntentDecision(raw, context) -> IntentDecision`, and `makeIntentRecord({requestId, originalText, context, decision}) -> IntentRecord`. The schema contains intent fields only: no edit operations, file paths or chosen asset handles. Validators enforce shape and reference membership; they do not pretend to prove that a plausible model interpretation is correct.

- [ ] Add tests: accepts a scoped room-size request with source-preservation text; rejects unknown target IDs, forged context references, `operations`, `assetId` selections and locally assigned identity fields in model output; rejects empty questions for clarification and nonempty questions for ready output. Explicit user-supplied numbers may remain in requestedOutcome; do not reject them merely because they look like parameters.
- [ ] Run `node --test tests/intent-contract.test.mjs`; expect failure from missing exports before implementing.
- [ ] Implement the schema/validators and local wrapper; preserve exact originalText. An uncertain target may be represented by an empty target list and a question, not a made-up ID. A ready revision requires resolvable targets within scope.
- [ ] Rerun the focused test; expect all passing. Review “keep the gunshot” evidence separately from any proposed DSP interpretation.

## Task 2: Project/session context lifecycle (A)

**Files:** Create `src/agent-context.mjs`, `tests/agent-context.test.mjs`.

**Interfaces:** `createAgentContext({sessionId, projectId})` returns `{recordTurn(turn), correct({turnId, supersedesTurnId}), snapshot({project, generation, scope, selectedLayerId}), reset({sessionId, projectId})}`. Produces ContextEnvelope. Store only session-local records in memory, not IndexedDB or project JSON.

- [ ] Add tests for duplicate layer names, explicit reference to a prior turn, correction provenance, discarded proposal, Undo after Apply, New/Open, and changed generation while a clarification is pending. Include 8 user clarification turns: no hard stop at turn 3.
- [ ] Run `node --test tests/agent-context.test.mjs`; expect failure before implementation.
- [ ] Build canonical facts fresh on every snapshot. Use a bounded cloud projection: recent 10 turns plus referenced turns required by an active clarification/preservation statement; enforce existing payload byte limits before dispatch. Keep the full session record locally; missing/truncated evidence must be marked unavailable or cause clarification, never silently promoted to fact. Do not add a model summarization job.
- [ ] On a changed project/session, clear contextual referents and pending clarification. On changed generation in the same project, retain history but invalidate target-dependent pending interpretation and refresh facts. Local history status comes from application events, not model wording.
- [ ] Rerun focused tests; expect all passing. Verify no storage or provider dependencies are imported.

## Task 3: Luna skill and isolated intent service (A)

**Files:** Create `server/intent.mjs`, `tests/intent.test.mjs`.

**Interfaces:** `createIntentService({invokeLuna})` returns `{interpret({requestId, prompt, context}, {signal}) -> IntentRecord}`. Injected `invokeLuna({instructions, input, schema}, {signal})` returns a parsed decision. This module has no API key, network fetch, environment switch or direct budget access; production binding belongs to Task 4.

- [ ] Add a scripted fake-provider suite: ambiguous referent returns a question; user correction changes interpretation without changing project; malicious candidate/history text cannot add executable operations; cancellation suppresses returned stale results. Assert original prompt and bounded canonical context are supplied to the fake, and only the intent schema is accepted.
- [ ] Run `node --test tests/intent.test.mjs`; expect failure before implementation.
- [ ] Implement instructions specifying understanding, context evidence and clarification ownership. Luna asks when unclear; no question-round limit, automatic forced guess or professional source/DSP choice. Discussion/cancel intents cannot authorize project edits.
- [ ] Check cancellation before and after invocation; validate output, attach local identity, and return. Invalid/failed responses return a typed failure with no retry.
- [ ] Run `node --test tests/intent-contract.test.mjs tests/agent-context.test.mjs tests/intent.test.mjs`; expect all passing. Run `npm test` once at the A delivery gate for regression coverage. No live provider call.
- [ ] Stop A and hand off exact files/checks. State explicitly that the main conversation UI still uses the baseline implementation until B. Do not commit/push without authorization.

## Task 4: Model-role dispatch and accounting prerequisite (B, gated)

**Files:** Create `server/model-policy.mjs`, `tests/model-policy.test.mjs`; modify `server/ai.mjs`, `server/budget.mjs`, existing budget/AI tests after schema approval.

**Gate:** Before implementing ledger changes or paid dispatch, present and obtain approval for model-specific pricing evidence, conservative per-call reservations and backward-compatible ledger handling. No values are guessed in this plan. No increase to the existing cap or invalidation/reset of old reservations. The new role remains fail-closed without an approved policy; tests use temporary fixtures and injected fictional rates explicitly labeled test data. This gate can be resolved without making a paid call.

**Interfaces:** Proposed `ModelDispatcher.invoke({role, instructions, input, schema, reasoningEffort}, {signal}) -> {value, model, usage, reservationId}`. Role allowlist maps intent to `gpt-6-luna`, professional to `gpt-6.1-sol`. `Budget.reserveFor(model)` and settlement are additive interfaces; preserve old `reserve()` compatibility until all callers are migrated. Any persistent record extension is separately approved at this gate.

- [ ] Add tests: fake-role routing selects correct model; no policy blocks before fetch; old mini/Sol fixture reservations remain counted; exhausted cap rejects before fetch; unknown/malformed usage cannot release a reservation; failed/aborted attempts keep it. Never read/write the user's real ledger in tests.
- [ ] Run relevant Node test files and confirm intended failures before implementation.
- [ ] Add role dispatch without weakening existing same-origin, request size, output size, serialization and AI-disabled protections. Reuse Responses transport; do not create two agents or an extra classifier model. Keep current reasoning values low/medium/high, default medium, unless a separate setting is approved.
- [ ] Implement only the approved accounting extension; rerun budget and provider-fake tests. Do not enable or probe a real key for acceptance.

## Task 5: Professional contract and one bounded coordinator (B)

**Files:** Create `src/planning-contract.mjs`, `server/agent-turn.mjs`, `tests/agent-turn.test.mjs`; modify `server/arrangement.mjs`, `server/ai.mjs`, `src/library-ai-contract.mjs` narrowly.

**Interfaces:** `AgentTurnService({intent, professional, search}).run({requestId, prompt, context, librarySummaryConsent}, {signal}) -> TurnResult`. `professional.decide({intentRecord, context, candidates, remaining}, {signal})` returns a validated search/propose/unavailable/clarify/discussion decision. A proposal reuses PROPOSAL_SCHEMA and adds rationale, unsupported requirements and a machine-checkable preservation constraint set. LibrarySearch retains `begin`, `search`, `summaries`, `details`, `clip`.

- [ ] Test: Luna clarification results in zero Sol/search calls; ready intent sends original text plus interpretation to Sol; malformed Luna output never reaches Sol; selected-layer requests cannot add/search sources. Test professional output cannot enlarge scope or override locally resolved identity.
- [ ] Add preservation tests: a room-only plan records the allowed room-field set and rejects source, gain/timing or unrelated-field diffs. Use existing ROOM_FIELDS, target IDs and prepared-project comparison. Free-form preservation that cannot be enforced must return an unresolved requirement, not a claim of protection.
- [ ] Add exact count tests: 3 Luna/3 Sol/3 search ceilings independently; failure/cancellation retains consumed counters; no model polling while awaiting user; new user message creates a fresh attempt without resetting the durable money ledger. Repeated user clarification beyond 3 rounds remains allowed.
- [ ] Add Sol/search sequencing test: first Sol search, second Sol search, third Sol final proposal = 3 Sol calls and 2 searches. Last remaining Sol call cannot request another search. Return a bounded unavailable outcome if the final response cannot produce a valid decision; never synthesize a fake plan or send call 4.
- [ ] Run `node --test tests/agent-turn.test.mjs`; expect failures before implementation.
- [ ] Implement coordinator-owned counters before dispatch and expose remaining capacity in model context. Preserve existing source snapshot/expiry checks. Sol-discovered ambiguity is phrased by Luna if a Luna call remains; otherwise surface the structured issue without another provider call. Discuss/cancel outcomes do not go through project mutation.
- [ ] Rerun focused coordinator, library-AI and arrangement tests; expect all passing. No arbitrary model retry or new source substitution.

## Task 6: HTTP/UI clarification and preview integration (B)

**Files:** Modify `server.mjs`, `src/conversation.mjs`, `src/settings.mjs`, `README.md`, `docs/LOCAL-API.md`; create `tests/agent-http.test.mjs`, `tests/agent-conversation.test.mjs`.

**API review:** Proposed new `POST /api/agent-turn` consumes `{requestId, prompt, context, librarySummaryConsent, reasoningEffort}` and returns TurnResult. Keep `/api/propose` and `/api/arrange` for compatibility; do not silently change their response shape. Approving B must explicitly include this new route. No change to portable project schemas.

- [ ] Test exact same-origin/token/Content-Type guards and 100 KiB cap. Server reconstructs allowlisted projectFacts using existing projectContext/normalization; browser-owned state is not mislabeled server-owned canonical storage. Request/anchor matching remains checked locally before preparation and Apply.
- [ ] Test UI flows with a fake local provider: ask then answer, 8 clarification turns, ambiguous duplicate names, manual edit during Luna, project switch during Sol, Undo after Apply, cancel during search, exhausted budget and unavailable model policy. Assert no proposal buttons for a question and no provider calls while waiting.
- [ ] Run the new tests to establish failures before implementation.
- [ ] Wire context tracking to existing conversation reset/sync/outcome events. Present “Understanding request”, “Waiting for your answer”, “Assessing sources” and “Preparing preview” as actual state, not proof of provider success. Display both configured model roles and per-stage usage without claiming configuration verifies access.
- [ ] Route proposal results through existing prepareArrangement/prepareProposal, detached renderer, schema acceptance and Apply/Discard. Reject preservation violations after candidate preparation and before rendering. Keep manual/offline library workflows available.
- [ ] Update README/API to reflect only implemented behavior and retain deferred live/Listening evidence. Do not modify .env.example to suggest unsupported model overrides.
- [ ] Run focused tests, then `npm test`. Use an isolated local browser fixture with injected fake responses to exercise clarification → proposal → preview → Apply → Undo and project switching. Keep real provider disabled, use a temporary library/ledger, leave existing user server/data untouched. Report fake-provider browser evidence explicitly.
- [ ] Stop B after agreed offline acceptance. No paid verification, publish, merge or version bump.

## Task 7: Selected-clip measurement evidence (C)

**Files:** Create `server/clip-analysis.mjs`, `tests/clip-analysis.test.mjs`; modify `server/library-search.mjs`, `src/library-ai-contract.mjs`, relevant search/privacy tests.

**Interfaces:** `analyzeClip({bytes, sourceRef}, {signal}) -> ClipMeasurement`. Input is verified WAV bytes from existing bounded extraction; output contains profile, original source frame range, sample rate, `coverage: 'selected_interval'`, peak/RMS/crest, activity fraction, clipping count, and <=128 peak/RMS envelope bins with clip-relative frame coordinates. Use <=30 s /24 MiB extraction bounds. Null dB represents silence. Do not invent decay-time or room classification from these metrics.

- [ ] Add independently computed fixture assertions: silent clip, constant-amplitude PCM, an isolated impulse, a transient followed by silence, and a quiet selected segment inside a louder full recording. Assert results depend on the selected frames, not full-source RMS; reject hash/frame mismatches and nonfinite audio.
- [ ] Run `node --test tests/clip-analysis.test.mjs`; expect failures before implementation.
- [ ] Analyze decoded channels locally with cancellation checks; limit any loop chunks to remain cancellable. Start with request-local reuse keyed by source identity, range and measurement profile; no new persistent cache format or reanalysis of existing records.
- [ ] Attach evidence to the existing bounded candidate session. Project model summaries through an explicit allowlist with selected_interval labeling; omit full provenance/path/raw samples/envelope arrays from the provider payload unless separately approved. Existing whole-source fields remain labeled separately. Hash/range identity stays local.
- [ ] Run clip, search and privacy tests. Verify candidate/session invalidation prevents reuse after root/catalog changes. Do not change retrieval semantic ranking or automatic full-library scanning as part of this task.
- [ ] Run `npm test` once after focused tests pass, then stop C. State that measured evidence is verified while real-model selection quality and human realism remain unverified.

## Acceptance map and deferred decisions

| Design requirement | Plan coverage |
| --- | --- |
| One Agent / Luna intent / Sol professional decisions | Tasks 1, 3, 4, 5 |
| Current-project/session memory and reference provenance | Tasks 1, 2, 6 |
| Unlimited user clarification, bounded automatic calls | Tasks 2, 3, 5, 6 |
| Original wording plus actual project facts reach Sol | Tasks 1, 2, 5 |
| Separate model budgets without fabricated estimates | Task 4 approval gate; no live activation until resolved |
| Local-only audio and selected-segment evidence | Tasks 6, 7 privacy checks |
| Scope/locks/preservation and exact-parent editing | Tasks 5, 6; existing project validators |
| Owned execution, preview/Apply/Undo, portable artifacts | Task 6; existing source/project regression suite |
| Lyra reference without runtime dependency | Task 2 adopts identity semantics only |
| Distinct evidence tiers | Each stage's completion handoff |

Unresolved financial policy is a visible B gate, not a missing number to fill by guesswork. Provider access, model suitability and audio quality remain unverified until separately authorized evaluation. No tests are run by writing this plan. Review proposed contracts, limits, API route and stage boundaries before approving implementation.

## Completion handoff

For each approved stage report files changed and why, focused/full checks, real versus fake provider evidence, browser/artifact evidence, limitations and external actions. Out-of-scope failures are reported, not fixed automatically. Implementation stops at the approved stage; later stages need approval. Commits and pushes are optional owner-authorized actions, not automatic task steps.
