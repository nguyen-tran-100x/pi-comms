# Spike #2 follow-up — revised identity, Stop/Pause and Gate C preparation

2026-10-28. New local evidence, separate from the original report at PR #7 head `96c5168`. Read current issues #1–#3 and owner reconciliation comment https://github.com/tranhoangnguyen03/pi-comms/pull/7#issuecomment-6463252862 . No live/paid model calls, merge, release, normal-session/package/broker/global-config modification or additional delegation.

## Revised identity result — pass for focused fixture scope

`prototype/session-send.ts` takes a native session ID. It checks retained owner approval, resolves that exact ID to an internal connection epoch and sends. Only a definite `rejected / E_TARGET_REBOUND` permits **one** refresh of the same ID using the **same message ID**. It never resolves names. Approval is checked again after resolution and before the retry. Unknown/throw does not retry. Persistent churn stops after two attempts.

`prototype/conversations.ts` now binds approval, counterpart and return linkage to native ID, not connection epoch. Optional epoch remains only a compatibility/diagnostic input in this fixture; runtime records normalize to native ID. Revocation remains an owner-side function, never a model tool. Existing tests were updated to the new contract without rewriting the historical report.

New observations:

- Native `SessionManager` saved/opened session retains its exact native UUID. A new connection registers that same UUID with a new internal epoch.
- Real owned original broker rejects the old connection epoch; bounded adapter resolves only the same native UUID and delivers once to its replacement connection. Similar-named sessions do not receive it.
- Another owned live OS process claiming that already-active native ID gets `E_SESSION_HELD`; incumbent stays uniquely listed. This tests concurrent distinct-process claims, not malicious PID spoofing or same-process duplicate claims.
- Unit fixtures cover approval revoked before refresh, resolution returning a different ID, repeated connection churn, unknown and thrown outcomes, and return-link acceptance after connection change.
- This is saved-session identity plus broker reconnect, **not a full interactive `/resume`/fork runtime journey**. Stable identity does not restore lost runtime approval/history/handles.

## Stop/Pause result — pass for native session fixture scope

Two focused real `AgentSession`/faux-provider tests add evidence:

- **Stop:** `session.abort()` ends the current run; adapter remains unpaused; a later peer is posted by explicit idle pump and starts a new model call. Earlier test still covers already-buffered peer after abort.
- **Pause:** arriving peers continue entering the buffer. Existing admitted content remains visible and running work completes normally. Explicit idle pump and a successful human turn cannot admit waiting peers while paused. Human work still runs. Resume plus one idle pump admits the retained FIFO snapshot with no repeated wake.

No change to native Stop and no global modal detector. These tests exercise SDK abort/pause state, not physical keyboard shortcuts or real human comprehension. Explicit idle pump remains fixture plumbing, not an installed timer.

## Inline UI preparation — runtime render checks pass

`prototype/inline-card.ts` adapts intercom's MIT inline card/expand-collapse pattern and native registration. Notice retained in `THIRD-PARTY-NOTICES.md`. Counterpart/subject/receipt shown in overview; batch summary supports expanded complete text, technical IDs, exchange and timestamp. Width checks cover 0, 1, 2, 12, 30 and 80 columns including wide characters. Native renderer callback/global expansion and fullscreen click behavior are checked. This is not a terminal screenshot or human usability validation; no dashboard or modal framework.

## Gate C preparation

Four native saved session files, separate homes/agent dirs/work dirs and synthetic evidence were prepared under `/tmp/pi-comms-spike/gate-c-20261028`. Manifest `destinations.json` records exact paths and native IDs. No model runtime, broker, process or credentials were started/copied by the preparation script.

Concrete plan: `docs/GATE-C-PLAN.md`. Proposed provider/model: OpenAI direct / `gpt-5.4-mini-2026-03-17`; **24 requests total, $2 cap, 15 minutes**, no automatic retries. Calls capped 6/10/8 across delayed reply / concurrent handbacks / human-input-Stop-Pause trials. One-request maximum 32,768 serialized bytes and 2,048 output tokens; conservative maximum reservation under $1 at checked pricing. Budget reservation helper is tested but provider dispatch is **not yet wired**; no live launch before explicit approval and preflight.

Access blocker: no `OPENAI_API_KEY` in current environment. Existing normal auth was not read/copied. Explicit isolated API credential use must be authorized/provided; missing access causes a stop, not provider fallback. This plan does not rely on a subscription's undefined dollar accounting.

## Verification

- `npm test`: **21/21 pass** (prior 13 plus Stop/Pause 2, same-ID unit 3, inline-card 2, budget 1; real broker test extended).
- `npm run test:original`: **32/32 pass**.
- Versions unchanged: Pi 1.4.0, intercom 0.18.1 pinned `02913ed`, Node 22.23.3, npm 10.9.9, macOS arm64.
- Local logs: `/tmp/pi-comms-spike/revised-final-tests.log`, `/tmp/pi-comms-spike/revised-original.log`.
- Existing dependency advisory remains; no deployment claim. No static typecheck or independent review performed. No Gate C launch or user validation.

**Next:** originating solution-design session obtains approval of the concrete Gate C limits/destinations and resolves API credential access. Live provider wiring and no-network preflight must pass before the first request. No PR/issue updates published by this follow-up step yet; historical PR report left untouched.
