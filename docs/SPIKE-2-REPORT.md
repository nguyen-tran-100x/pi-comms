# Spike #2 — Gate A/B evidence and decision

Date: 2026-10-27. Scope: isolated source inspection, fixtures and minimal prototypes. No production extension or base implementation. No paid model calls, other-agent delegation, installed-package modification, normal broker/session changes or rollout.

## Executive decision

**Gate A: conditional go for runtime feasibility work, not a universal attention-safety pass.** Coherent FIFO batching at a successful Pi turn boundary works. Human input already queued takes precedence. Draft checks are available. Arbitrary modal/attached-view ownership is not exposed by the public Pi 1.4.0 extension context. A host must provide readiness, or the product must state a narrower guarantee and use pause. No silent fallback or UI patch is justified.

**Gate B: go for a narrowly scoped implementation, with explicit integration work still required.** Volatile approval/linkage/outbox fixtures and a real broker protocol probe establish the useful runtime contracts. Native ordinary-send replies cannot reuse intercom's ask-only `replyTo`. Exact routing must freeze both session id and endpoint epoch, without the client's rebound retry. Runtime loss is accepted and observed; it is not recovered.

**Gate C: not run and not passed.** Separate approval is still needed for model, cost/turn bounds and dedicated destinations. Fixture results are not real model judgment, UI ownership integration, user validation or release readiness. Do not close #2 as fully proven or #3 as implemented.

## Versions and reproduction

| Item | Actual value |
|---|---|
| Original intercom | 0.18.1, `02913edcd7b1bdb21b480852ff82f674d309c651` |
| Pi coding agent / AI / TUI | each 1.4.0, npm lockfile pinned |
| Node / npm | 22.23.3 / 10.9.9 |
| Host | macOS (`darwin`) arm64 |
| tsx / typebox | 4.20.6 / 1.0.62 |
| Original regression selection | 32/32: 7 human-priority native Pi tests + 25 reply-tracker tests |
| New spike selection | 13/13: 7 native Pi/faux-provider tests, 5 conversation tests, 1 real broker test |

Commands: `npm ci --ignore-scripts && npm run prepare:fixture && npm run test:original && npm test`. The README explains isolation. Only this platform/version combination was checked; it is a reference, not a minimum-version or cross-platform promise. No benchmark or fixed tuning budget was derived.

## Gate A — expected versus observed

| Scenario | Expected | Observed / evidence |
|---|---|---|
| Original busy delivery | Hold peer, admit one at eligible successful assistant turn boundary | Original real-AgentSession fixture passes; no abort/restart needed. See upstream `human-priority.pi.test.ts`, `index.ts` 1315–1448 and 2228–2235. |
| Coherent intake | One native message contains the FIFO snapshot | `attention.test.ts`: A/B share one custom-message post; C and later D share the next. Full text and order retained. Test bound of two forces overflow; not proposed tuning. |
| Pending human input | Native steer/followUp precedes peer | Original fixture covers steer and followUp. New batch fixture confirms queued steering delays admission. |
| Input around posting | State guarantee narrowly | New fixture records human steering submitted after peer posting appears later. No retroactive priority or atomic cross-source race guarantee. |
| Unsent draft | Do not post while draft exists | Public `getEditorText()` check holds new fixture. Original receiver does not make this check. Whitespace is also treated as draft. |
| Modal/attached view | Hold when the host reports ownership | Explicit `hostReady=false` fixture holds. **Not an actual modal/attached runtime integration test.** Public Pi 1.4.0 context has no global modal/attached-ownership query. Host must provide it, or guarantee must exclude unknown ownership and offer pause. |
| Aborted turn | Do not consume busy steer after abort | New native session fixture leaves batch held; explicit idle pump posts later. Original test also covers idle handoff. Whether user Stop should additionally pause reception remains a UX decision, not inferred from abort alone. |
| Manual compaction | Keep arrivals outside native transcript while compacting | Actual `session.compact()` is held inside a scripted `session_before_compact` hook; `isIdle=false`; batch remains queued, then reaches provider in full after compaction. Summary itself is a fixture, not a real model summary. |
| Session switching | Old context cannot inject into replacement | Native shutdown event expires held fixture payload. Original runtime generation/context invalidation is source-inspected. Actual `/new`/`/resume`/fork/attached-view journeys were not driven. |
| Posting versus saving | Do not equate handoff with native storage | Successful API call is recorded as posting only. After normal continuation, actual session JSONL contains one `custom_message` entry. We did not implement or claim a crash-safe acknowledgement system. |
| Message authority | Attribute peer; preserve host checks | Provider projection of custom message is **user role**, not a security-isolated peer role. A scripted tool attempt triggered from peer content reaches `tool_call`; host denial prevents side effect. No claim that attribution constrains an unrestricted host/model. |
| Idle wake | Avoid repeated starts for one snapshot | Local wake reservation blocks repeated explicit pump while a batch starts; no receipt model calls. Original source uses a held timer and idle reservation. New prototype has no production timer and does not claim production scheduling completeness. |

### Attention reuse finding

Original intercom already has the useful primitives: held FIFO, runtime generation checks, successful-turn steering, idle path, and idle-wake reservation. Reuse that shape, not a new attention subsystem. Its busy path checks `hasPendingMessages`; its idle path lacks the same pending check and neither path checks global modal ownership. Do not label the original behavior a blanket human-priority guarantee.

## Gate B — expected versus observed

| Scenario | Expected | Observed / evidence |
|---|---|---|
| Exact recipients | Similar names and changed endpoints never receive stale work | In-process exact id+epoch fixtures reject changed handles. Real original broker accepts frozen current id+epoch, rejects frozen stale epoch after restart; only intended destination sees the message. |
| Existing client caveat | Inspect actual retry behavior | `broker/client.ts` 638–708 resolves names/prefixes and automatically resolves/retries `E_TARGET_REBOUND`; native replies bypass its exact-target path. This is **not** the immutable peer-handle contract. The raw-wire fixture demonstrates existing broker support; production adapter still needs an exact-send entry point with no rebound substitution. |
| Approved contact | Only owner approval enables normal contact | Unapproved send/receive fails in prototype; peer text claiming approval cannot add contacts or recruit a third. Approvals apply to exact endpoints. No user-facing capture or trusted owner integration was built. Same-account processes are not adversarially isolated. |
| Delayed ordinary reply | No ask-state dependence | Real Pi faux trajectory executes 4 assistant turns and 3 tools (two evidence reads then handback); existing return handle links response to exact request. Five-turn in-process sequence, overlap, clarification and correction also pass. No real model interpreted or chose the handle. |
| Native ordinary reply | Verify original mechanism | Real broker rejects `replyTo` to an ordinary send with `E_REPLY_TARGET`. It is ask-edge dependent. Use a communication envelope over addressed sends for runtime linkage rather than native ask-only `replyTo`; real broker probe carries such request/reply envelopes successfully. |
| FIFO/overflow/new arrivals | Preserve complete later messages | Batch and conversation tests retain overflow and new arrivals in order; no generated summary or truncation. This tests intake overflow, not bounded-memory or hostile payload capacity. |
| Replies/receipts | No obligatory acknowledgement/model wake | `receive` generates no outbound send; fixture receipt/status work starts no model. No live autonomous reply-loop experiment was performed. |
| Inspect/unknown send | Retain prior send ID; no blind retry | Volatile outbox retains original ID and `unknown` after simulated lost response. Transport is called once. Real original broker suppresses repeated same-ID/same-payload send. No persistent recovery proof. |
| Sender/receiver restart | Do not invent continuity | Recreating each volatile runtime loses approvals, queue/outbox and return handles. Old handle reports context lost; traffic cannot restore approval. Owner can explicitly reapply approval. These are in-process runtime recreation tests, not OS-kill tests. |
| Broker restart | State loss visible | Owned broker process is stopped and restarted: queued mailbox message is absent; endpoint epoch changes. No claim that it was delivered/recovered. Original client has no persistent mailbox. |

## Required blueprint clarifications

1. **Attention claim:** human-first means already-pending native input and checked draft/readiness at admission. A human arriving after posting can come later. Universal modal/attached protection requires a supported host readiness signal or small upstream API; it is not proved by a fake readiness flag.
2. **Exact handle:** bind both broker session id and endpoint epoch. Do not reuse the original client's rebound retry or fuzzy resolution for sends. Broker already accepts frozen targets; expose that narrowly rather than add a routing framework.
3. **Conversation link:** carry `exchange`/`replyTo` in the runtime envelope for ordinary requests. Original broker `message.replyTo` is ask-only and unsuitable unchanged. Keep return handles across ordinary tools/turns, separate from ask state.
4. **Authority:** owner approval capture must remain outside model-callable tools. Fixture `approveFromOwner` is an injection point, not completed authentication or UI. Incoming text never restores lost approval.
5. **Status:** observe native saved evidence before saying saved. A posted batch can later appear in JSONL, but this does not create a durability/recovery guarantee.
6. **Stop UX:** original abort can be followed by idle peer wake. Decide and test how user Stop and reception pause interact in Gate C; do not silently redefine native stop.

These are proposed clarifications in this PR, not silent edits to issue bodies. No database, membership service, fixed retention/wake quota, orchestration engine or UI monkey-patch is needed to express them.

## Implementation recommendation

Proceed with the smallest Pi-first adapter after resolving host readiness. Reuse original transport framing/exact-target protocol and attention lifecycle; keep ordinary conversation bookkeeping outside ask-only tracking. Do not wholesale fork the original 3,000+ line extension with its cross-machine, pane-launch and handover features just for this slice. Spike did not measure the effort of extracting all necessary broker dependencies, so no code-reduction percentage is claimed.

Keep the first version volatile and honest. This spike has no persisted approval, replay recovery or cross-restart handle. Rejected stale handles should require fresh exact discovery plus human/owner approval, not name remapping. When a send is unknown, inspect existing runtime evidence first; never auto-create a new send ID.

## Verification limits and dependency result

- No Gate C paid calls, actual human usability study, arbitrary modal or attached UI integration, full session-runtime switching/fork journey, hostile peer security proof, saturation test, packaged base extension, release or install/rollback test.
- No changes to installed Pi/intercom, global config or normal broker. Only owned temporary subprocesses were terminated. No other sessions were recruited.
- `npm audit` reports two affected dependency nodes: high-severity transitive `undici@8.10.2` and moderate aggregate on Pi coding agent. Advisories include [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c), [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685), and [GHSA-f72v-6w45-q472](https://github.com/advisories/GHSA-f72v-6w45-q472). Baseline is deliberately unchanged for reproducibility; no `npm audit fix --force` downgrade. Fixture model tests do not access remote providers. Dependency readiness needs separate assessment before a deployable package.
- Scripts use Node's TypeScript loader via tsx; no separate static typecheck was run. Tests exercise runtime behavior. Report review was same-session, not independent.

## Local evidence paths

Author's isolated workspace: `/tmp/pi-comms-spike/work` (macOS canonical path `/private/tmp/pi-comms-spike/work`). Original source clone remains `/tmp/pi-messaging-research/intercom` and was not modified. Logs under `/tmp/pi-comms-spike/` are local, untracked: `final-original.log`, `final-spike.log`, `clean-install.log`, `audit.json`. These paths are not portable artifacts; the committed tests/lockfile are the reproducible evidence.

## Next decision

Review the spike PR and its narrowed claims. It does not implement #3 or complete Gate C. Before live experience testing, approve the model, turn/cost bounds and dedicated test destinations. Before a base implementation promises modal safety, provide/verify host attention ownership or explicitly adopt the narrower guarantee. No release or merge is performed by this spike.
