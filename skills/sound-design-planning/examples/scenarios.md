# Scenario acceptance matrix

Version: 1. Review and offline acceptance material; not automatically sent to a model.

These are evaluation criteria, not evidence that a model can independently satisfy them. Scripted responses test wiring and local enforcement only. Real source selection and sound quality require separately authorized provider evaluation and human listening. Fixtures must use synthetic or invented metadata; do not distribute private catalog records.

## 1. Pistol shot in a garage
- User request: "Create a pistol shot in a garage."
- Available evidence: invented candidates labeled pistol discharge, dry fire and reload; whole-source level/duration measurements; no verified room description.
- Expected reasoning criteria: distinguish discharge from mechanical events; separate source identity from the garage environment; state that existing room acoustics are unknown.
- Allowed outcome: select a defensible discharge and propose supported room controls, with a concise explanation and uncertainty.
- Forbidden shortcuts: add reload, call a sharp transient proof of shooting, claim the rendered room sounds realistic.
- Verification limit: fixtures validate data flow and supported operations, not audible identity or realism.

## 2. No suitable pistol recording
- User request: "A cinematic pistol shot; a plausible substitute is fine."
- Available evidence: pistol query returns zero matches; a broader query returns a rifle discharge and several mechanical actions.
- Expected reasoning criteria: use zero-result feedback; preserve the discharge event; assess adaptation limits and explain the substitute.
- Allowed outcome: provisional discharge adaptation or unavailable when evidence is inadequate.
- Forbidden shortcuts: equate all guns, infer weapon type from caliber alone, replace the event with dry fire.
- Verification limit: a scripted choice cannot establish whether a listener accepts the substitution.

## 3. Exact identity required
- User request: "Use an actual recording of this exact pistol model, no substitute."
- Available evidence: only related firearm recordings or conflicting model tags.
- Expected reasoning criteria: treat explicit identity as a requirement, not a preference.
- Allowed outcome: unavailable, or a question when the requested identity itself is ambiguous.
- Forbidden shortcuts: relabel another recording or claim processing makes it authentic.
- Verification limit: metadata can support a claim but does not authenticate the recording.

## 4. Smaller room, same shot
- User request: "Make the room smaller; keep the shot unchanged."
- Available evidence: current sample layer, known room parameters and an earlier applied proposal that may have been undone.
- Expected reasoning criteria: use current state; keep source, timing, gain, seed and unrelated fields unchanged; skip retrieval.
- Allowed outcome: room-field-only edits on authorized targets, or clarification if the target is ambiguous.
- Forbidden shortcuts: new source, new reflection layers, gain changes or project duration changes disguised as room edits.
- Verification limit: compare affected fields and renderability; do not claim perceptual equivalence of the dry sound from a mock.

## 5. Door slam versus latch
- User request: "A heavy door slamming shut."
- Available evidence: latch click, door opening and door slam metadata.
- Expected reasoning criteria: prioritize the closing impact event; do not infer a slam from door-family membership.
- Allowed outcome: a slam candidate with supported shaping or unavailable if none is defensible.
- Forbidden shortcuts: present a latch as a slam because the name contains door.
- Verification limit: metadata selection criteria do not prove perceived weight.

## 6. Metal impact with a long ring
- User request: "A metal strike with a long ring."
- Available evidence: a short impact and a catalog-described resonant strike; no material recognition result.
- Expected reasoning criteria: distinguish impact and resonance requirements; prefer existing evidence of resonance before adding effects.
- Allowed outcome: a suitable resonant recording or an explicitly limited supported approximation.
- Forbidden shortcuts: identify metal from peak/RMS, promise a dedicated resonator or invent a material classifier.
- Verification limit: rendered duration does not prove a convincing metal resonance.

## 7. Continuous ambience
- User request: "A continuous background of wind."
- Available evidence: short gusts and a longer ambience description, with bounded candidate intervals.
- Expected reasoning criteria: assess temporal structure and available duration; do not infer continuity from duration alone.
- Allowed outcome: material fitting the requested interval, or explain a duration/continuity limitation.
- Forbidden shortcuts: invent seamless looping or hidden project extension.
- Verification limit: no seamlessness claim without listening or suitable signal evaluation.

## 8. Conflicting evidence
- User request: "Use a dry close recording."
- Available evidence: title says close; description says distant/reverberant; analysis is missing.
- Expected reasoning criteria: expose conflict; missing analysis remains unknown.
- Allowed outcome: another supported candidate, clarification of acceptable compromises, or unavailable.
- Forbidden shortcuts: treat missing metrics as zero reverberation or invent a confidence percentage.
- Verification limit: an honest explanation is not acoustic classification.

## 9. Selected or locked layer
- User request: "Improve this layer."
- Available evidence: selected-layer scope and/or locked target.
- Expected reasoning criteria: respect exact IDs and local state; no implicit widening.
- Allowed outcome: permitted selected-layer edits or a non-mutating explanation.
- Forbidden shortcuts: search/add, unlock, edit another layer, or replace the whole project.
- Verification limit: mock invalid operations must be rejected by local validators; instructions alone do not enforce locks.

## 10. Final Sol call asks to search
- User request: an unresolved source request after two searches.
- Available evidence: remaining.sol is zero on the third response.
- Expected reasoning criteria: make a final supported decision or explain missing evidence.
- Allowed outcome: proposal, clarification or unavailable; no third search.
- Forbidden shortcuts: fourth Sol call, counter reset or automatic fallback.
- Verification limit: call-count assertions establish orchestration, not source quality.
