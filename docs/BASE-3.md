# Base #3 — local implementation and verification

Date: 2026-10-28. Starting revision: `bbafcce4896f515204dd6da04a626c46f2bd358c`, PR #7 open/unmerged at source check. These are Base candidate changes for review, not a release or issue-completion claim. Historical spike reports are unchanged.

## Implemented

- Versioned `pi-comms` 0.1.0 candidate with explicit Pi manifest, MIT licence/notices, compiled extension and standalone broker. No runtime npm dependencies; Pi/typebox/TUI remain host-provided peers.
- Selected pinned MIT intercom broker/client/framing/health-and-spawn-lock reuse in a separate `comms` runtime namespace. No bridge to intercom, Herdr discovery, pane launch or model execution.
- Public native-session UUID addressing. The production client exposes exact sends only. Shared same-ID helper re-resolves once after definite epoch rejection and rechecks retained approval; no unknown-outcome retry. Concurrent active claims, including same-process claims, are rejected.
- First-send native human confirmation with automatic continuation of that send. Incoming contact requests surface to the person at an eligible idle boundary; only confirmed requests enter the model. `/comms requests` reopens held decisions, `/comms approve` remains optional manual management. No preapproval ritual or ID relay. Approval is not an agent-controlled envelope field. Revoke, first-run/reset notices, waiting status, Pause/Resume and inspection.
- Unapproved arrivals stay human-visible but cannot enter model context or wake it. Approval is separate on each standalone participant; inbound content cannot create it.
- One schema-derived send/reply input, explicit return handles, multiple exchanges/responses, correction linkage, refs, volatile queue/outbox/message inspection and paginated full-item evidence. Invalid/oversize input rejects, not truncates.
- Human-first FIFO batch snapshots at eligible busy/idle boundaries; native pending human input and checked draft take precedence. Later arrivals remain for a later snapshot. Pause holds admission/wakes; Stop only stops the current run.
- MIT-derived native inline collapse/expand cards, narrow-width checks, tool-result expansion and no global modal framework. Host tool permissions are not changed.
- Facts distinguish socket acceptance, receiver memory queue, native post and locally observed saved entry. Receipt/presence traffic never calls the model intake path. No fact means work completed.

## Checks

Environment: macOS arm64, Node 22.23.3, Pi 1.4.0.

- `npm run check`: production source TypeScript check passes.
- `npm run test:base`: 22/22 pass. Includes actual compiled extension loaded by native resource loader; isolated broker and two real Pi sessions with a scripted local faux provider.
- `npm test`: 49/49 pass: 22 Base tests plus 27 historical/prototype spike tests. These are not 49 tests of the production implementation.
- `npm run test:original`: 32/32 pinned upstream regression tests pass.
- `npm run test:artifact`: builds/packs, installs tarball into a temporary prefix with peers omitted, loads via real Pi resource loader, then reruns 8 native Base integration scenarios against the installed artifact. No normal environment installation.
- `git diff --check`: passes.
- Clean temporary checkout: `npm ci --ignore-scripts && npm run verify` passes without pre-existing node_modules, dist or upstream fixture.

The original Base lifecycle journey exercises refusal/confirmation of owner approval, known/all discovery, held unapproved traffic, driver-invoked tool definitions separated by human prompts, draft hold, two handbacks in one batch after queued human steering, later C in a later batch, actual Stop/later peer wake, Pause/Resume buffering, `AgentSessionRuntime.newSession`, `switchSession` to resume the original native ID, lost volatile approval/linkage, and `fork` to a distinct ID. That journey alone is not evidence of model-selected tool integration.

The added deterministic Base model/tool journey uses the real native tool execution loop and is rerun against the temporarily installed tarball. Coordinator calls `comms_peers`, uses the returned exact approved ID in `comms_message`; recipient makes two real `read` tool turns against synthetic files, then extracts the return handle from its received model context and calls `comms_message`. Assertions check actual `tool_execution_end` events, read results reaching subsequent provider requests, linked response IDs/exchange and resulting runtime state. Standard approval selection is exercised without supplying IDs, using scripted native UI responses (not human usability validation). The unchanged prototype test remains the evidence for host permission denial/compaction, not the Base trajectory.

Separate real-wire production test deliberately replaces a resolved recipient connection before exact send: stale epoch is definitely rejected, the same native ID is resolved once more, and exactly one message arrives at the replacement. A same-named session receives nothing. Revocation between resolution/send prevents transmission; unknown send outcome is attempted once. Duplicate claims are explicit.

A bounded independent read-only review identified the omitted startup lock and receive-only reconnect gap; both were repaired and regression-tested. Simultaneous first connects now share one broker; native sessions automatically rejoin after broker termination using bounded reconnect backoff. Active duplicate claims remain rejected; a destroyed old socket can be reclaimed. Replies whose original request record was lost retain full content with explicit `context-lost` linkage rather than being dropped. Native settlement releases wake reservations. These are local fixes verified by tests, not a second independent review claim.

No model API calls were made for Base verification. Earlier paid Gate C evidence is historical, not repeated.

## First-contact UX repair after real-use feedback

The owner attempted real work and hit `CONTACT_NOT_APPROVED`. The previous first-run instructions required separate manual contact setup in both sessions; the collapsed error also omitted its recovery action. This was observed onboarding friction, not user error or evidence of a reset. Earlier guided/scripted tests did not establish an acceptable real-use experience.

The first actual send now collects human confirmation in place and continues without reissuing the task. It validates the exact recipient and input first. Incoming requests produce a visible human notice/indicator and one native confirmation when idle/no pending human input or draft/not paused. Peer content remains outside the model until that person approves; confirmation covers bounded collaboration and replies, not tool or mission authority. Cancellation/refusal sends nothing or leaves incoming content held; repeated peer arrivals/tool attempts do not loop approval dialogs. `/comms requests` supports explicit reconsideration. Noninteractive callers get approval-required recovery; Stop and session invalidation abort open dialogs. Error cards include nextAction.

The focused independent review of this repair found two additional issues before live use: unchanged waiting widgets were being rebuilt every timer tick, and a cancelled contact could not be reconsidered through a new ordinary human instruction. Widget/status updates now run only on changes. Only a new native human input (not extension/model/peer continuation) clears the declined-outbound suppression, allowing the next send to ask again. Incoming approval context explicitly labels the peer-supplied title instead of presenting it as a user-written mission. These findings were checked against source and covered by regressions; no repeat review round was run.

Four new native integration scenarios (also rerun from the installed artifact) cover:
- The normal model/tool review with **no preapproval commands**: empty known discovery → broader discovery → send waits for sender decision → recipient decision → two actual read turns → linked reply. Assertions check no outbound record or recipient model request before confirmation, one decision per participant, no reply setup, and exact linkage.
- Cancellation/refusal and automatic retries, new-human-instruction reconsideration without a management command, unchanged-widget stability, held incoming content and explicit reconsideration, noninteractive refusal, signal cancellation and actual native Stop while the approval tool is waiting.
- Cancelling an outgoing send does not silently refuse a later independent incoming contact decision; that request still gets its own human prompt without admitting content.
- Editor-draft and Pause precedence for incoming contact decisions; session replacement cancels an old dialog even if its late result says Allow.

These are deterministic execution/interaction tests, not a claim that an unfamiliar model or the owner has accepted the revised UX. No paid trials repeated. Real-use acceptance is still pending.

## Readable human inspection and approval presentation

`/comms inspect` now opens a bounded read-only native view, not an editable JSON document. Counterpart, subject, contact state, latest observed fact, full message content and references are primary. Technical details reveal native/message/exchange IDs, timestamps, original reply/correction references, return handles, every fact/source/evidence reference, response IDs and outcome codes. The projection still reads the existing runtime records; no second inbox or authoritative state is introduced.

The view uses native Text wrapping and ScrollView scroll state, keyboard/mouse navigation, Details and next/previous message pages. Queue pagination retains complete payloads. Closing/aborting restores the underlying work; the owning inspection continues to hold peer admission. No editor exists in this path. RPC uses read-only native selections over the same presentation; callers without a UI do not load or emit human-only content. Agent/script inspection and its withholding boundary are unchanged.

First-contact confirmation now puts colleague, work and the explicit Yes/No effect before the preview and exact native identity. The same prompt retains approval scope, user/tool precedence and reset lifetime; manual contact setup explicitly says it does not send a message. Consent and routing semantics are unchanged.

Six new Base tests cover prompt order/scope, complete human content with hidden/revealed technical evidence, 65-message pagination/back navigation without consumption, narrow/wide/Unicode rendering and read-only keyboard/mouse/abort behavior, native regular/fullscreen overlay lifecycle/resize, and RPC/no-UI boundaries. The installed-artifact integration path now exercises the actual read-only inspector; its editor mock fails if inspection tries to open one, and subsequent provider requests are still checked for private-content leakage.

A focused independent read-only review found no blocking defect in the view. Native primitives were retained instead of introducing a separate scrolling/modal system. Rendered tests are automated evidence—not real-user readability or accessibility validation. Global arbitrary-modal detection remains outside scope.

## Session labels and revoked-contact recovery

Two focused native regressions failed on 6f1a0bf before repair:
- Native `setSessionName` did not update the broker, leaving discovery/first-contact labels stale. The extension now publishes `session_info_changed` through the existing `updatePresence` method, including clearing a name back to the stable UUID fallback. Connection completion also publishes the current name so a rename during registration is not lost. Incoming presence updates refresh display-only labels for held requests/cards/contact management; none changes routing identity or grants approval.
- After pause → queued approved message → revoke, the widget offered `/comms requests` but its separate request map was empty. Contact requests now derive from the actual unapproved waiting queue, grouped by exact sender, rather than another copy of request content. Reapproval through the advertised command leaves Pause intact; Resume posts the original message exactly once.

The installed-artifact suite includes rename/discover/first-contact/approve/revoke selector/name-clear checks and the complete pause/send/revoke/requests/reapprove/resume recovery path. Filtered test runs now have unconditional module teardown for their owned temporary broker/runtime, even when the final lifecycle scenario is not selected. No live sessions or normal installations were restarted for verification.

## Native error visibility repair after live reply feedback

Real use exposed another presentation defect: a reply included `subject` alongside `respondTo` and `text`. Native Pi correctly rejected the extra field before extension execution, but its error result had no pi-comms details. The custom renderer replaced that useful validation explanation with a generic failure label. The subsequent correctly shaped reply succeeded; native receiver history contains it. This does not establish broad agent reliability or completed human acceptance.

The renderer now preserves native textual results when extension-specific details are absent, including native validation/permission errors. The tool description explicitly says replies inherit the original subject and must omit `to` and `subject`. Strict validation remains intact; no fields are silently discarded and no unknown send is retried.

The installed-artifact model/tool scenario now deliberately submits a reply with the extra subject, asserts the actual native error reaches the subsequent provider request **and the collapsed human renderer**, then submits the corrected reply. It checks two tool attempts, one native pre-execution error, one outbox record and one correctly linked response. No live-model retry was launched by this repair.

## Review corrections after d1491d1

- Reproduced the confirmed unapproved-inspection leak with a failing regression before the fix. Model-facing projections now expose only routing IDs and `CONTACT_NOT_APPROVED` metadata for unapproved incoming records, withholding subject/body/references/return handles across queue, message and exchange views, including after revocation. `/comms inspect` explicitly selects the complete human projection.
- The installed-artifact model/tool journey sends an unapproved message, inspects it via three actual model tool calls, and checks all subsequent provider requests for leaked payload or handle. Human inspection retains full evidence; later approval enables normal content visibility without granting authority from traffic.
- Inspection now returns `localTransport.connectivity` and local hold state, not a misleading global/counterpart `current.presence`. Regression switches the recipient away, confirms exact-peer discovery says offline while inspection labels only the sender's local connection online.
- Cards carry `corrects`, show a collapsed correction label and expanded referenced ID. Renderer and actual envelope-to-card projection are tested.
- Two overlapping Base exchanges run interleaved clarification, reply and correction cycles; exact exchange membership and reply/correction references are asserted. These additional messages are driver-issued, not claimed as model judgment.
- `npm run verify` prepares the pinned fixture before combined tests, then runs build/typecheck, combined tests, separate originals and installed-artifact checks. Fresh-checkout instructions follow that dependency order.

## Dependency advisory assessment

Initial audit found `undici 8.10.2` through development Pi 1.4.0/OpenAI dependencies. Current advisory metadata lists several DoS, redirect-disclosure and TLS-option problems, including GHSA-xjj6-f33q-929c, GHSA-4w7w-5xrc-9h26 and GHSA-2m5v-pch6-74hx. Affected range is below 8.12.2; npm registry reports patched 8.12.2 supports Node >=22.19.0.

The candidate uses only local Node sockets for communication, not undici HTTP. It bundles no undici/Pi runtime. Development override pins undici 8.12.2; the lockfile was regenerated and all checks above rerun. `npm audit` now reports zero advisories in this development graph. This does **not** repair or certify an independently installed host Pi, particularly prebundled host code. Host dependency security remains the host maintainer's responsibility and must be reviewed before rollout. No forced Pi downgrade or normal-runtime install was performed.

## Reuse / surface comparison

This is a surface comparison, not an invented reduction percentage:

- Original intercom 0.18.1 uses a 3,431-line extension entry point plus broker/client and helpers; its manifest has one extension, skills and runtime `tsx ^4.20.0`.
- Base has three communication tools and one human `/comms` command. It omits ask/current-turn reply, worker/pane launch, cross-machine interfaces, task ledger and mandatory persistence.
- Base retains the upstream broker's internal legacy ask/extension-bus code to avoid an unrequested transport rewrite. Those protocols are not exposed through the public tools. A narrower broker extraction could be a separate maintenance change, not claimed here.
- Base bundles compiled transport and has zero runtime npm dependencies. Host peers remain external. Build/test dependencies do not ship in the artifact.
- Both counts include different capabilities; source line counts and passing test counts are not measures of user value or bloat savings.

## Known limits / remaining acceptance

1. **Real-person walkthrough is outstanding.** Native lifecycle/card tests and scripted-provider journeys are automated, not human usability validation. Do not close Base or call it shipped on this evidence alone.
2. No persistence/crash recovery. All approval, queue/outbox and return-handle state is volatile. Native saved history is evidence only, not restored transport/approval state. Same saved address is not lost linkage recovery.
3. Human approval uses standard host confirmation UI. There is no agent approval tool or policy bypass, but unrestricted same-account code/other extensions are not isolated. No broader security claim.
4. Reception checks pending native input/draft and its own approval/inspection interaction only; no arbitrary modal/attached-view protection. Input arriving after post may follow it.
5. Only Pi 1.4.0/macOS arm64/Node 22.23.3 verified. No untested cross-harness or platform support claim.
6. No paid model trial repeated, global install, merge or release. Base candidate d1491d1 was pushed to PR #7 on the owner's explicit request; this is not shipment. Maintainer/release/rollout approval remains separate.

## Representative human walkthrough

Use two existing isolated Pi sessions sharing a dedicated test agent directory; load the reviewed tarball, not normal installs. The person should:

1. Give the agent a real collaboration task without setup commands. Check whether the first-send and incoming confirmation make the colleague, work, consequences and cancellation clear.
2. Ask one agent to request a read-only review. Let the colleague use tools and return through the provided handle. Check sender/recipient, subject and expanded full content/details.
3. Queue two handbacks during work, type a draft/steering message and check the stated human-first behavior.
4. Stop a run and observe that later peer traffic can wake; Pause reception, send another message, verify it waits, then Resume.
5. Switch away and resume the saved session: understand approval/linkage reset versus unchanged native address. Fork and see the new identity.
6. Read status/inspection without interpreting accepted/posted/response as completed work.

Record what the person actually observes and any confusing wording. No paid calls without separate bounded approval; the scripted provider can demonstrate mechanics, but it remains synthetic model behavior.
