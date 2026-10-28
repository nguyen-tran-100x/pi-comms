# Base #3 — local implementation and verification

Date: 2026-10-28. Starting revision: `bbafcce4896f515204dd6da04a626c46f2bd358c`, PR #7 open/unmerged at source check. These are Base candidate changes for review, not a release or issue-completion claim. Historical spike reports are unchanged.

## Implemented

- Versioned `pi-comms` 0.1.0 candidate with explicit Pi manifest, MIT licence/notices, compiled extension and standalone broker. No runtime npm dependencies; Pi/typebox/TUI remain host-provided peers.
- Selected pinned MIT intercom broker/client/framing/health-and-spawn-lock reuse in a separate `comms` runtime namespace. No bridge to intercom, Herdr discovery, pane launch or model execution.
- Public native-session UUID addressing. The production client exposes exact sends only. Shared same-ID helper re-resolves once after definite epoch rejection and rechecks retained approval; no unknown-outcome retry. Concurrent active claims, including same-process claims, are rejected.
- `/comms approve`: native selector, collaboration input and human confirmation. Approval is not an agent tool/envelope field. Revoke, first-run/reset notices, waiting status, Pause/Resume and inspection.
- Unapproved arrivals stay human-visible but cannot enter model context or wake it. Approval is separate on each standalone participant; inbound content cannot create it.
- One schema-derived send/reply input, explicit return handles, multiple exchanges/responses, correction linkage, refs, volatile queue/outbox/message inspection and paginated full-item evidence. Invalid/oversize input rejects, not truncates.
- Human-first FIFO batch snapshots at eligible busy/idle boundaries; native pending human input and checked draft take precedence. Later arrivals remain for a later snapshot. Pause holds admission/wakes; Stop only stops the current run.
- MIT-derived native inline collapse/expand cards, narrow-width checks, tool-result expansion and no global modal framework. Host tool permissions are not changed.
- Facts distinguish socket acceptance, receiver memory queue, native post and locally observed saved entry. Receipt/presence traffic never calls the model intake path. No fact means work completed.

## Checks

Environment: macOS arm64, Node 22.23.3, Pi 1.4.0.

- `npm run check`: production source TypeScript check passes.
- `npm run test:base`: 7/7 pass. Includes actual compiled extension loaded by native resource loader; isolated broker and two real Pi sessions with a scripted local faux provider.
- `npm test`: 34/34 Base plus historical spike tests pass.
- `npm run test:original`: 32/32 pinned upstream regression tests pass.
- `npm run test:artifact`: builds/packs, installs tarball into a temporary prefix with peers omitted, loads via real Pi resource loader, then reruns the native Base journey against the installed artifact. No normal environment installation.
- `git diff --check`: passes.

Native Base journey exercises refusal/confirmation of owner approval, known/all discovery, held unapproved traffic, return after multiple native turns and tool calls, draft hold, two handbacks in one batch after queued human steering, later C in a later batch, actual Stop/later peer wake, Pause/Resume buffering, `AgentSessionRuntime.newSession`, `switchSession` to resume the original native ID, lost volatile approval/linkage, and `fork` to a distinct ID. Tools run through native registered definitions for inspection/sending; normal host permission regression remains covered by the unchanged native spike test.

Separate real-wire production test deliberately replaces a resolved recipient connection before exact send: stale epoch is definitely rejected, the same native ID is resolved once more, and exactly one message arrives at the replacement. A same-named session receives nothing. Revocation between resolution/send prevents transmission; unknown send outcome is attempted once. Duplicate claims are explicit.

A bounded independent read-only review identified the omitted startup lock and receive-only reconnect gap; both were repaired and regression-tested. Simultaneous first connects now share one broker; native sessions automatically rejoin after broker termination using bounded reconnect backoff. Active duplicate claims remain rejected; a destroyed old socket can be reclaimed. Replies whose original request record was lost retain full content with explicit `context-lost` linkage rather than being dropped. Native settlement releases wake reservations. These are local fixes verified by tests, not a second independent review claim.

No model API calls were made for Base verification. Earlier paid Gate C evidence is historical, not repeated.

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
6. No paid model trial repeated, global install, merge, push, release or publication. Maintainer/release/rollout approval remains separate.

## Representative human walkthrough

Use two existing isolated Pi sessions sharing a dedicated test agent directory; load the reviewed tarball, not normal installs. The person should:

1. Understand the first-run notice and select/approve the exact colleague for a named collaboration; cancel once and verify no approval.
2. Ask one agent to request a read-only review. Let the colleague use tools and return through the provided handle. Check sender/recipient, subject and expanded full content/details.
3. Queue two handbacks during work, type a draft/steering message and check the stated human-first behavior.
4. Stop a run and observe that later peer traffic can wake; Pause reception, send another message, verify it waits, then Resume.
5. Switch away and resume the saved session: understand approval/linkage reset versus unchanged native address. Fork and see the new identity.
6. Read status/inspection without interpreting accepted/posted/response as completed work.

Record what the person actually observes and any confusing wording. No paid calls without separate bounded approval; the scripted provider can demonstrate mechanics, but it remains synthetic model behavior.
