# pi-comms — Base 0.1.0 candidate

Communication between existing Pi sessions: user-approved contacts, exact native session addresses, replies across turns/tools, and human-first batches. It does not launch agents or own their work.

**Local review candidate, not released.** Tested with Pi 1.4.0, Node 22.23.3, macOS arm64. Other versions/platforms are not claimed. [Base integration evidence and limits](docs/BASE-3.md). Historical [spike delivery](docs/GATE-C-DELIVERY.md) and [Gate A/B report](docs/SPIKE-2-REPORT.md) remain unchanged.

## Build and try in isolation

```sh
npm ci --ignore-scripts
npm run build
npm run test:base
npm pack --ignore-scripts   # build first; produces pi-comms-0.1.0.tgz
```

To try without modifying normal Pi settings, use an owned temporary agent directory and the unpacked package:

```sh
mkdir -p /tmp/comms-try/package
# Extract the reviewed tarball into /tmp/comms-try/package (npm tarballs contain package/).
tar -xzf pi-comms-0.1.0.tgz -C /tmp/comms-try
PI_CODING_AGENT_DIR=/tmp/comms-try/agent pi -e /tmp/comms-try/package
```

Launch the second Pi with the same isolated agent directory. No mandatory init command. The local broker starts at session startup, not factory evaluation. It uses `comms/` under the configured agent directory, separately from intercom. No automatic bridge or migration of existing intercom asks.

Do not change normal installations or publish this candidate without owner approval. After release, the reproducible package source is `npm:pi-comms@0.1.0` **only if that version has actually been published**; it is not currently an available-install claim.

## First run

Ask your agent to work with the colleague, for example:

> Have Reviewer review the current implementation and return supported findings. Do not edit.

The agent discovers the exact colleague and attempts the send. **First contact opens a native human confirmation** with colleague, work and Yes/No consequences first. Request preview, exact session and approval lifetime follow. Allow it and that same send continues—no setup command, ID relay or repeated task prompt.

On the recipient's side, the request stays held for the person. A visible contact-request notice and waiting indicator appear; when the recipient is idle with no pending human input/draft and reception is not paused, a native confirmation asks whether to allow that collaboration. Allowing releases held messages at the next eligible human-first boundary and allows replies for the work. Neither peer traffic nor a tool call grants itself approval: only the person's confirmation writes it. The recipient still follows its own user mandate.

Cancel/refuse an outbound prompt: nothing is sent. Cancel/refuse an incoming prompt: content remains held for the person, not the model. Further arrivals or automatic agent retries do not repeatedly reopen a rejected contact prompt. If you give the agent a new instruction to proceed, its next send can ask you again. Use `/comms requests` to reconsider an incoming request directly, or `/comms approve` to establish/change a contact explicitly. These commands are recovery/management options, not first-run prerequisites.

Unapproved content remains fully human-visible in `/comms inspect`; model inspection returns only IDs and a contact-approval hold, withholding subject, body, references and return handle. Noninteractive callers without human approval UI fail with an actionable approval-required result; no consent is inferred. Native Stop or session replacement cancels pending approval without sending. Peer messages cannot broaden approval or bypass host tool permissions. Same-account IPC and prompt attribution are not a security sandbox.

## Everyday commands

- `/comms` or `/comms status`: approval/context, waiting count, hold reason and reset limitations.
- `/comms requests`: review/reconsider held incoming contact requests, including queued messages from a contact you revoked.
- `/comms approve [exact-session-id]`: optional explicit contact setup/change through human selection/context/confirmation.
- `/comms revoke [exact-session-id]`: remove contact approval after confirmation; queued traffic remains held.
- `/comms pause`: keep buffering arrivals without peer admission/wakes.
- `/comms resume`: resume eligible intake.
- `/comms inspect [message-id]`: read waiting messages or a specific message without consuming/admitting it. The read-only view shows counterpart, subject, full content, references and observed state—not editable JSON. Use arrows/PageUp/PageDown to scroll, **d** for technical evidence, **n/p** for more/previous messages, and **Esc/q** to close. It is a snapshot, not a second inbox. RPC clients use equivalent read-only selections; model/script inspection remains structured.

**Stop ends the current run. A queued or later peer message can wake it again. Pause holds incoming peer admission/wakes until Resume.** Pause does not stop existing work or retract admitted content. Stop/corrections do not roll back effects already performed.

Native inline cards show counterpart, subject, batch and receipt; Ctrl+O expands full content and technical details. The footer shows waiting/paused/hold state. Already-pending native input and checked editor drafts win at admission. Input after posting may follow the batch. There is no universal arbitrary-modal detector. Use Pause when you want reception held.

## Agent tools

- `comms_peers({})`: known approved colleagues first, with context/reason. `view: "all"` discovers others without contacting them.
- `comms_message({to, subject, text, refs?, corrects?})`: start an exact-session exchange; first contact asks the person and continues this send if allowed. Do not ask the user to preconfigure contacts. Cancellation sends nothing; do not retry unless the user asks.
- `comms_message({respondTo, text, refs?, corrects?})`: answer the explicit return handle after turns/tools; no blocking ask.
- `comms_inspect({message})`, `({exchange,cursor?})`, `({queue:"self",cursor?})`, `({outbox:"self",cursor?})`: non-consuming runtime evidence. Not a polling duty.

Schemas reject unknown fields and ambiguous destinations. Native UUIDs only, no name/prefix routing. Corrections reference the sender's prior message to the same peer. References are pointers, never uploads. Messages over 900,000 serialized bytes reject with a reference-based next step. Inspection pages retain full approved items and return a cursor. `localTransport.connectivity` describes this session's broker connection, not the counterpart's presence; use `comms_peers` for exact colleague presence. Multiple replies are allowed, not owed.

Same-ID reconnect refresh is internal: after a definite stale-epoch rejection, re-resolve only that same native ID once and recheck approval. Unknown send outcome never automatically retries. Concurrent active claims are rejected explicitly. A fork/new session has a different identity. Renaming a session updates discovery and contact labels without changing its native ID or approval binding; clearing its name restores the UUID display fallback.

## Facts and volatile state

- **Accepted:** broker/socket transport accepted it. Not proof the recipient model saw it.
- **Queued:** receiver memory holds it.
- **Posted:** handed to native Pi.
- **Saved:** a native session entry was actually observed locally.
- **Response:** a linked peer message exists. None of these means work completed.

No crash durability. Approvals, buffers, message/outbox records and return handles reset on reload, session switch or process restart. Resuming the same saved session preserves its native address, not lost runtime linkage/approval. The next contact attempt asks for approval again; report context lost/unknown instead of inventing recovery. The broker retains legacy best-effort mailbox behavior internally, but the public exact-send path rejects unavailable peers instead of promising offline delivery.

## Update and rollback

Pause and finish/inspect outstanding work before replacing the package. Record useful work products outside the transport. Exit participating sessions, replace the reviewed artifact, then restart and renew contacts. Rollback uses the previously retained artifact in the same way. Buffers/linkage may be lost in either direction. There is no durable schema migration or guaranteed replay. Do not blindly repeat uncertain sends after restart.

## Verification

After `npm ci --ignore-scripts`, run the complete check in the required order:

```sh
npm run verify            # prepare pinned fixture, build/typecheck, all tests, originals, installed artifact
```

Individual steps:

```sh
npm run prepare:fixture   # required before npm test in a fresh checkout; downloads pinned MIT upstream
npm run test:base          # builds + tests production path, no paid calls
npm test                  # Base and historical/prototype tests, no paid calls
npm run test:original      # separate pinned original-intercom regressions
npm run check
npm run test:artifact     # pack/install in isolation + rerun Base model/tool and lifecycle journeys
```

Packaged-artifact installation is tested in a temporary prefix/agent directory, never a normal installation. Dependency advisory assessment, exact evidence and the outstanding **real-person walkthrough** are in [BASE-3.md](docs/BASE-3.md). Automated TUI/scripted-provider tests are not human usability validation.
