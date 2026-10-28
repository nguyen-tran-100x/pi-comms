# Gate C — first live attempt, partial result

2026-10-28. Current user approved the concrete plan, then explicitly replaced provider/model with `https://ai-router.davidustranus.space/v1` / `gpt-5.6-luna` and removed the dollar cap ("no limit"). Request/output/payload/time limits remained 24 requests / 2,048 output tokens / 32,768 bytes / 15 minutes, no automatic extra round. Temporary credential was passed in the owned process environment, not stored in repository files or normal auth/config.

## Preflight

Authenticated metadata lookup lists `gpt-5.6-luna`, owned_by `combo`, tools supported. No router prices or pinned underlying model were supplied; cost and physical model identity are **unknown**. No OpenAI direct API price assumption applies. Shared dispatch now restricts the exact router Responses endpoint/model and disables the dollar calculation while retaining all other limits. Metadata lookup is not a generation request.

25/25 local tests passed, including actual provider serialization intercepted without network. Owned broker/faux-provider runner smoke performed synthetic file reads in the isolated session; no model generation request in smoke.

## Live observation

**Trial 1 — PASS for delayed ordinary handback.** Reviewer A received one ordinary request, performed `fixture_read(evidence.txt)` then `fixture_read(detail.txt)` in separate assistant/tool turns, called `comms_message` using the original explicit return handle, and stopped. Coordinator received the exact linked findings and produced a concise response without a mandatory acknowledgement send. Native saved transcripts contain request and reply batch entries; reviewer transcript contains two successful read results and successful comms_message result. No human ID repair was used.

- Request ID: `44a2d270-fb83-48d2-bfe1-976173a2ff41`.
- Response ID: `d441002e-05ad-4225-a00c-9a134e7d70ca`.
- Exact destinations: approved coordinator `01a18183-5369-7115-9764-e1cb3a272f42`, Reviewer A `01a18183-536e-7115-9764-e1cc1c256f61`.
- **Five completed generation responses observed** (reviewer four, coordinator one), 2026-10-28 08:29:14–08:29:20 UTC. Returned totals: input 7,256; cache-read 8,064; output 164; totalTokens 15,484. These are router-reported counts, not independently measured billing.
- Pi populated `usage.cost` using inherited OpenAI catalog estimates. **Those dollar figures are invalid for this router and must not be reported as actual spend.** Subsequent code zeros catalog estimates and continues labeling router spend unknown; no subsequent live request was made.

**Trial 2 — BLOCKED before its model request.** Coordinator's normal native `prompt()` checked `ModelRuntime.getAuth()` before entering the wrapped stream and rejected: `No API key found for openai`. The custom-message trigger path in Trial 1 had reached the wrapped explicit-key stream, so this integration gap was not caught by the original provider-only interception test. Runner exited with an unhandled prompt rejection before Trial 2's generation request; no final summary had been written. All trial resources were owned; post-failure process inspection found no remaining owned broker process.

**Trial 3 — NOT RUN.** No live Stop/Pause/human-input trajectory or interactive human/overlay validation occurred. Existing native-session/faux-provider Stop/Pause tests remain valid fixture evidence, not substituted live proof.

## Diagnosis and local repair (not live-rerun)

`bindGateCProvider` now explicitly sets the supplied key through isolated `runtime.setRuntimeApiKey` (runtime-only; no auth file write) before streaming. The no-network test asserts `runtime.getAuth(model)` succeeds, protecting the native prompt preflight. Runner attaches rejection handlers and cleanup behavior so a rejected prompt becomes a recorded trial failure instead of an unhandled process exit. 25/25 regression tests pass after this repair. No paid retry/continuation was launched, respecting the plan's stop-after-failure rule.

The 24-call dispatch had no durable attempt journal in the first process and final cleanup did not run after the unhandled rejection. We can substantiate **five completed provider responses** in the native session and event evidence, not claim a durable exact attempt ledger. No additional completion is present. A subsequent run requires an approved bounded continuation, must retain used calls (19 maximum remaining), and must not repeat Trial 1 automatically. Add pre-dispatch attempt logging before continuation.

## Evidence and limits

- `/tmp/pi-comms-spike/gate-c-20261028/live-events.jsonl`: observed sends/receipts, five assistant response usage events.
- Native JSONL paths in `/tmp/pi-comms-spike/gate-c-20261028/destinations.json`.
- `/tmp/pi-comms-spike/router-preflight.log`, `post-live-regressions.log`: 25/25 local checks.
- No actual native interactive terminal UI/human usability validation; SDK UI hooks only. Minimal inline component checks are not screenshots or human evidence.
- No base implementation, merge/release, extra delegation, normal broker/session/config edits, or provider fallback. Temporary key value is omitted from all evidence documents.

**Next decision:** authorize a continuation for Trials 2/3 only, with at most 19 remaining requests and the same endpoint/model/output/time limits, or stop with partial Gate C evidence. Interactive human observation remains separately distinguishable from scripted SDK checks. This is not a Gate C completion claim.
