# Gate C approved limits — local preflight, live access blocked

2026-10-28. After the concrete plan was presented, the current user said **“do it”**. The named model/provider, 24-request/$2/15-minute limits and four exact destinations are treated as approved. This does not supply a credential or authorize reading normal auth files. The original `GATE-C-PLAN.md` remains the proposal history.

## Work completed after approval

- `prototype/gate-c-dispatch.ts`: one shared dispatch reserves every actual HTTP attempt; enforces exact direct OpenAI Responses URL, model snapshot, 2,048-token output, reasoning none, store false, no hosted tools/media/provider-managed conversation; no redirects, per-request timeout, total wall-clock cutoff and per-trial 6/10/8 ceilings. Any unknown network error stops further calls; reservations are not refunded.
- `prototype/gate-c-provider.ts`: wraps an isolated ModelRuntime only, explicit direct API key required; forces requested snapshot and disables provider retry. No normal auth lookup or provider fallback.
- `test/gate-c-provider.test.ts`: actual Pi/OpenAI serialization intercepted with a fake `sk-` key, zero network. Confirms exact snapshot, reasoning none, output cap 2,048 and one charged attempt. Simulated HTTP 400 stops dispatch. During preflight a fake key without `sk-` activated subscription semantics and omitted max_output_tokens; requiring a direct API key fixed the fixture and prevents that path.
- `prototype/gate-c-session.ts`: small owner-approved peer tools, explicit return handle, synthetic read-only tools, inline-card registration and Pause/Resume command/status. Admission reuses the tested FIFO adapter. Component/tool integration fixture passes.
- Dedicated session preparation now provides both synthetic evidence files. Existing four native IDs are unchanged. No credential, broker or live model process started.

## Verification

`npm test`: **25/25 pass**. New dispatch tests (2), provider interception (1) and small session adapter test (1) supplement the prior 21. Log: `/tmp/pi-comms-spike/approved-preflight-tests.log`. `git diff --check` passes. Original tests last passed 32/32 in the preceding step; not re-counted as a new run here.

No live model requests, no billed usage from the trial, no Gate C success claim. Provider 400 was entirely local fake response. Full trial-runner/broker/native interactive view wiring and an end-to-end no-network smoke still precede live launch; component preflight is not that proof.

## Access blocker and next step

`OPENAI_API_KEY` was rechecked and remains absent. No normal Pi/CLI auth or environment files were searched/read/copied. Owner must provide an explicit direct API credential through the launch environment, or a private mode-600 temporary file outside the repository whose path they explicitly supply. Do not paste secrets into chat.

After access exists: complete full runner smoke with fake transport, then execute only the three approved trials; stop on any preflight error or approved stop condition. No model/provider fallback or automatic extra paid round. Changes remain local and unpublished. Original historical report untouched.
