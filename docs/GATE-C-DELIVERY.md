# Gate C delivery — live behavior verified, UI checks automated

2026-10-28. **Final delivery record.** Keep `SPIKE-2-REPORT.md` and `GATE-C-RESULTS.md` as historical observations. This document supersedes their next-step guidance where it concerns the completed continuations, not their measured facts.

## Summary

| Trial | Result | Evidence |
|---|---|---|
| 1. Delayed ordinary reply | **Pass** | Reviewer used two real file reads on separate model turns, then the original return handle; coordinator received the correctly linked finding. No blocking ask or human routing rescue. |
| 2. Concurrent handbacks | **Pass** | Reviewer A/B handbacks admitted as one FIFO snapshot; Reviewer C arrived while coordinator was processing and was admitted in a second batch. Full content retained. |
| 3. Human intervention | **Pass for scripted SDK behavior** | Actual live model runs exercised Stop, later peer wake, Pause buffering without wake, Resume, draft blocking, and queued human steering before peer admission. |
| Inline UI | **Pass for automated component/native TUI checks** | Collapsed/expanded complete cards and wide-character/narrow widths; actual TuiMainScreen renderer/overlay/focus smoke. **No real-person usability study or complete interactive CLI keyboard journey.** |

**27/27 local tests and 32/32 original tests pass.** No normal-session/package/broker/global-config modifications; all homes, saved session files, processes and contacts were dedicated to this experiment. No additional delegation or cross-harness work. No release/merge. This is a small spike prototype, not base #3.

## Authorized model and limits

The owner supplied router base `https://ai-router.davidustranus.space/v1`, model `gpt-5.6-luna`, and a temporary API key; then explicitly removed the dollar cap and instructed autonomous completion. The key is not in repository files or normal auth. Model metadata reports tools supported and `owned_by: combo`; underlying physical model/snapshot and router prices are unknown. Catalog cost values are not billing evidence.

Retained experiment limits: **24 actual model HTTP requests overall, 2,048 output tokens/request, 32,768 serialized request bytes, no automatic provider retries, 60 seconds/request**. Each process has a 15-minute cutoff. The active live execution across all continuations was under two minutes; elapsed wall time across preparation and permission exchanges was longer and is not represented as one uninterrupted 15-minute run. Continuations carried the already-used request count rather than resetting it. **20 total requests/completed responses observed**; Trials 1/2/3 used 5/9/6 respectively, within the planned per-trial 6/10/8 ceilings.

The first process did not write a durable request-attempt journal. Its five completed responses and the pre-generation native auth failure establish observed model activity; no stronger durable exact-attempt guarantee is claimed. Continuations journal attempts 6–20 before dispatch. No unknown HTTP send was retried. No repeated Trial 1 or Trial 2 after success.

### Router-reported usage

Across 20 nonzero-usage responses:

- Uncached input: **22,276 tokens**
- Cached input: **43,008 tokens**
- Output: **524 tokens**
- Reported total: **65,808 tokens**

These are router-reported counts, not independently measured invoices. **Actual spend is unknown.** First-run Pi `usage.cost` inherited OpenAI catalog pricing and is invalid for this router; subsequent code sets catalog estimates to zero to avoid false dollar claims. Zero estimates do not mean free usage.

## Trial details

### 1 — delayed handback

- Request `44a2d270-fb83-48d2-bfe1-976173a2ff41`.
- Response `d441002e-05ad-4225-a00c-9a134e7d70ca`.
- Reviewer A executed `fixture_read(evidence.txt)`, then `fixture_read(detail.txt)`, then `comms_message(respondTo: original handle)`. Coordinator received and interpreted the finding.
- Saved native JSONL contains both custom batch entries and successful read/message tool results. Exact native identities remained the prepared coordinator/reviewer IDs.

### 2 — batch snapshot and later arrival

Coordinator entered a real model-selected hold tool. A and B were working independently; their handbacks were buffered while the coordinator remained in that turn. On release, both entered one custom batch. Coordinator entered a second hold; C then returned, and the next boundary admitted C alone.

Observed FIFO batches:

1. `2890037e-1f89-461d-a52e-2e35ed15ba7c`, `a0d9fa5e-934d-42d9-9d43-d9f820de4238`.
2. `66e3c24e-8a5e-4145-bfda-cc2431dc636c`.

The coordinator summarized the findings without a mandatory acknowledgement send. The runtime did not generate receipt-only wakes.

### 3 — Stop/Pause/draft and queued human input

- Coordinator called the hold tool; SDK Stop aborted that work.
- An approved peer message arrived while reception was paused. Receipt/buffering continued; neither admission nor model wake occurred.
- Resume with an unsent draft still held the peer. Clearing the draft admitted it once and produced a later model response.
- In a separate live steering substep, peer findings were held during a tool; a human-origin SDK steer was queued before release. The saved native message ordering placed the human directive at index 25 and peer batch at index 27. Model response included the human marker before processing the peer.

This is operator-scripted behavior, not a claim that a person pressed the physical Stop shortcut or judged clarity. It demonstrates bounded admission priority, not retroactive ordering of input after a post.

## Failures encountered and repaired

1. **Native prompt auth precheck:** custom-message triggered requests reached the explicit-key stream wrapper, but normal `session.prompt()` rejected before streaming because ModelRuntime had no runtime key. Set the supplied credential using isolated `setRuntimeApiKey`; regression test now checks native auth readiness. No normal auth file is read/written.
2. **Intentional Stop accounting:** Pi emitted a zero-token error lifecycle entry after aborting the hold tool, with no corresponding HTTP dispatch. Harness incorrectly treated it as missing provider usage. It now distinguishes the operator-controlled stop interval from provider-request results. This is not permission to ignore unknown network usage; dispatched requests remain journaled and charged against count.
3. **Original exception handling:** first runner allowed an unhandled rejected prompt to exit without its final summary. Added handlers/cleanup and reconstructed the initial result from raw event/native history evidence, labeled as reconstructed. Continuation summaries are written normally.

These were experiment-harness issues, not demonstrated wrong-recipient delivery or transport loss. Completed trial evidence was retained; failures were not erased or described as passing.

## UI findings

`prototype/inline-card.ts` adapts the original MIT component and uses native message renderer registration. Expanded details retain full body, IDs, exchange and timestamp. `test/native-tui.test.ts` drives actual Pi TuiMainScreen with an in-memory terminal: an overlay stays the input owner during a background card update; closing it restores the transcript. This confirms custom UI/overlays are supported. It does not create a global modal detector or guarantee arbitrary attached-view ownership.

No human validation was available; a native terminal screenshot/usability judgement is not claimed. The human-facing Stop/Pause wording and inline status are implemented in the prototype. Base acceptance still needs a finished packaged UI and representative real-person walkthrough, not another architecture framework.

## Artifacts and reproduction

- Code/tests in this PR; original intercom pinned at `02913edcd7b1bdb21b480852ff82f674d309c651`, Pi 1.4.0, Node 22.23.3, npm 10.9.9, macOS arm64.
- Workspace `/tmp/pi-comms-spike/work`.
- Prepared identities/paths: `/tmp/pi-comms-spike/gate-c-20261028/destinations.json`.
- Live event evidence: `live-events.jsonl`, `continuation-events.jsonl`, `trial3-events.jsonl`, `steer-events.jsonl` under that root.
- Summaries: `live-summary-reconstructed.json`, `continuation-summary.json`, `trial3-summary.json`, `steer-summary.json`.
- Final local logs: `/tmp/pi-comms-spike/delivery-tests.log`, `delivery-original.log`.
- `npm ci --ignore-scripts && npm run prepare:fixture && npm run test:original && npm test` reproduces fixtures without live model calls. `scripts/run-gate-c.ts --dry` exercises isolated faux plumbing; paid runs require explicit environment key, dedicated manifest and intentional operator choice. Do not infer authorization from saved files or repeat the live experiment automatically.

## Delivery review and known prototype limits

Same-session source review and regression checks completed; no independent reviewer was delegated. The live runner currently uses the original addressed-send client after checking an exact native ID; the bounded same-ID refresh helper is separately tested but not yet wired into that runner path. Do not describe the spike as a finished public API. Runtime approval/handle state is intentionally volatile, and continuation setup reapplies the approved crew, not prior traffic. The budget ledger tests include carried request counts and journal-before-network ordering. A secret scan found no real key in deliverable source/docs. Original historical report is unchanged.

## Final judgment

The spike supports the proposed Pi-first runtime contracts: stable native addressing, bounded same-ID refresh, ordinary multi-turn conversation linkage, coherent batching, honest volatile-state loss, explicit Stop/Pause and native inline rendering. **No new architecture is needed.** Keep persistence optional and avoid generalized membership, mandatory acknowledgement or modal ownership frameworks.

The authorized spike is delivered. Remaining base work is packaging, completed first-run/contact UI, exact-send adapter integration and real-person walkthrough, plus dependency advisory assessment before shipment. No claim of production readiness, universal UI safety, crash recovery or adversarial same-account isolation.
