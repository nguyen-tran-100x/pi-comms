# Gate C approval plan — prepared, not launched

2026-10-28. This plan requests approval of concrete limits; it does not record approval. No live/paid model calls have run. Historical report remains unchanged at `docs/SPIKE-2-REPORT.md`; revised evidence is in `docs/SPIKE-2-FOLLOWUP.md`.

## Model and access

- Provider: **OpenAI direct API**, `https://api.openai.com/v1`, standard non-regional endpoint.
- Model: **`gpt-5.4-mini-2026-03-17`**, text only, reasoning effort `none`, max output **2,048 tokens per request**, including any billed reasoning if the provider includes it.
- Official price checked 2026-10-28: **$0.75/M input, $4.50/M output**. Source: https://developers.openai.com/api/docs/models/gpt-5.4-mini . No cached-input discount assumed.
- Pi 1.4.0's installed catalog contains the alias `openai/gpt-5.4-mini`; the exact snapshot must be bound explicitly in the isolated configuration. No silent alias/model/provider fallback.
- **Access blocker:** `OPENAI_API_KEY` is not present in this process environment. No normal auth files were read/copied and no account availability request was made. Owner must explicitly provide/authorize a direct API credential through an environment variable for the owned process. Do not paste it into chat or commit it. If snapshot/access is unavailable, stop and revise the plan, not switch provider.

## Hard run limits and proposed spend cap

- **24 total model requests/assistant turns maximum across all four sessions and all three trials**, including aborted, failed or retried requests. Trial allowances 6 / 10 / 8, not additive retries. No automatic model-call retries or repeat trials. A failure stops that trial and dependent work.
- **$2 USD maximum authorized spend**. Reservation helper is prepared and tested in `prototype/gate-c-budget.ts`; it is **not yet wired to a live provider transport**. Wiring and a no-network interception test must pass before any launch.
- Per request: complete serialized provider payload at most **32,768 UTF-8 bytes**, max output **2,048 tokens**. Reject larger payloads; do not silently truncate. Reserve full input cost conservatively using UTF-8 bytes as text token upper bound plus **8,192 tokens for provider framing**, and full possible output cost before sending. No images, audio, hosted tools, web search, file uploads, or provider-managed conversation state.
- Worst-case reservation: `24 × ((32768+8192)×0.75 + 2048×4.50)/1e6 = $0.958464`, below the $2 cap. No refunds for aborted/unknown requests. One shared parent ledger atomically reserves the budget for concurrent sessions. SDK and HTTP retries disabled. Reject any unexpected endpoint/model/output limit, inaccurate reservation assumptions or billable service.
- Record actual returned usage and reservations after every call. The $2 bound is client-side at the documented prices, not a provider billing-account hard cap; if price/usage behavior differs, stop. With 24 one-attempt requests and the token bounds, expected maximum is under $1, not permission to spend the remaining cap.
- Wall-clock cap **15 minutes for the entire approved live run**, **60 seconds per model call**. Aborts keep their full reservation. No new calls after a limit or unknown transport outcome.

## Exact isolated destinations

Prepared local native saved sessions, **not running or registered in the normal broker**:

| Role | Native Pi session ID |
|---|---|
| Coordinator | `01a18183-5369-7115-9764-e1cb3a272f42` |
| Reviewer A | `01a18183-536e-7115-9764-e1cc1c256f61` |
| Reviewer B | `01a18183-536f-7115-9764-e1cfe7349fc1` |
| Reviewer C | `01a18183-536f-7115-9764-e1d021dccdeb` |

Root: `/tmp/pi-comms-spike/gate-c-20261028`. Exact session JSONL paths/homes/cwds/agent dirs: `destinations.json` under that root. Each role has its own `home`, `agent`, `sessions`, and `work/evidence.txt`. Only public synthetic fixture data is present. Preparation script: `node --import tsx scripts/prepare-gate-c.ts`; it reuses the manifest without changing IDs. A single owned test process may host these four Pi SDK sessions; it is not four delegated harnesses. No new contacts beyond this approved trial crew.

Reserved short broker runtime agent directory: **`/tmp/pcc-uB6hQI`**, recorded in the manifest; no socket/process started. At launch use `PI_CODING_AGENT_DIR=/tmp/pcc-uB6hQI` and an owned HOME under the Gate C root for the one original-broker subprocess, never installed broker paths. Apply only the approved coordinator↔reviewer contacts through owner-side injection. Reviewers may not recruit/contact each other. Direct API traffic is solely to the approved OpenAI endpoint; peer traffic is solely to the above local sessions.

## Three trials (serial)

1. **Delayed ordinary handback — up to 6 requests.** Coordinator sends one ordinary request to Reviewer A. Reviewer A reads two synthetic files through actual read-only tools on separate model turns, then selects the supplied return handle and sends findings; coordinator interprets the linked response. Success: exact request/response linkage after tools, no blocking ask or human ID repair. The model decides the tool calls; faux responses are not substituted.
2. **Concurrent handbacks — up to 10 requests.** Coordinator sends bounded work to A/B/C. Hold coordinator at an eligible native boundary while handbacks arrive. Admit a single FIFO snapshot; arrange one later arrival during handling and verify later intake. Success: full findings, one coherent intake for the first snapshot, later arrival retained, no obligatory acknowledgement loop. Session requests may overlap; parent call reservations remain serial/atomic.
3. **Human input, Stop and Pause — up to 8 requests.** In the coordinator's native interactive view, queue a human steer/draft during peer arrivals; Stop the run; show a later peer may wake it. Pause reception, send another peer message, observe buffered/paused indicator without model wake; Resume once. Open a native custom overlay briefly to document behavior without asserting global detection. Success: promised bounded ordering, clear Stop/Pause distinction and intelligible native inline cards. If no human observes the native UI, report operator-scripted behavior only—not human usability validation.

## UI and tools

Minimal MIT-derived inline component is prepared at `prototype/inline-card.ts` using `registerMessageRenderer` and standard TUI width/wrapping utilities. Collapse shows counterpart/subject/receipt or batch overview; expansion shows full text, IDs, timestamps and exchange reference. Ctrl+O/global expansion and fullscreen click follow native rendering conventions. Waiting/paused status and command help must state: **Stop ends current run; Pause holds peer messages.** No dashboard/modal framework.

Only actual fixture-file reads, bounded peer messaging and inspection tools are exposed; no shell/network tools to the models. Existing host `tool_call` approval hooks remain. Model text from peers is visibly attributed and cannot mutate the owner approval list.

## Pre-launch work and stopping conditions

Before launch, after approval: connect the prepared cards/session identities to the small live test adapter; wire exact same-ID refresh, owner approval, Pause/Resume and the shared budget to provider dispatch; dry-run with faux transport to verify endpoint/model/output/token/request limits and native UI renderer. Do not claim those pieces are live-integrated now. Stop instead of launching if any preflight fails.

Stop all owned trial work on wrong recipient, name substitution, unauthorized contact, approval bypass, unexplained repeated wake, Pause admission, disrupted human control, model/turn/spend/time/payload bound, missing/unknown provider usage, uncertain send that would require a blind retry, or any attempt to access normal sessions/broker/config. Preserve local logs and native transcripts; terminate only owned processes. No further delegation, merge, release or cross-harness expansion.

## Deliverable

Per-trial expected/actual results, exact versions/model IDs, request/token/cost reservations and actual usage, message/batch linkage, native transcript/UI evidence, errors and untested limits. Report failures honestly; no automatic additional paid round. Return findings to the originating solution-design session. **Next action: approve this named model, 24-request/$2/15-minute limits, four exact destinations and direct API credential use, or revise the plan.**
