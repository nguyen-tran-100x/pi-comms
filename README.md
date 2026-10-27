# pi-comms — isolated feasibility spike

**This is evidence for [Spike #2](https://github.com/tranhoangnguyen03/pi-comms/issues/2), not the base implementation or a loadable Pi extension.** It does not register `/comms`, publish tools, launch real agents, or install a broker into your normal runtime.

Read [the Gate A/B report](docs/SPIKE-2-REPORT.md) for results, limits and decisions. The governing proposal remains [blueprint #1](https://github.com/tranhoangnguyen03/pi-comms/issues/1). Base work is tracked separately in [#3](https://github.com/tranhoangnguyen03/pi-comms/issues/3).

## Reproduce

Tested on macOS arm64, Node 22.23.3, npm 10.9.9, Pi 1.4.0.

```sh
npm ci --ignore-scripts
npm run prepare:fixture
npm run test:original
npm test
```

`prepare:fixture` downloads a clean original intercom clone into gitignored `.scratch/upstream`, verifies commit `02913edcd7b1bdb21b480852ff82f674d309c651` (0.18.1), and points its dependency resolution at this lockfile's dependencies. It neither patches upstream nor changes installed packages. Re-run with a clean clone if verification fails.

The original tests use owned temporary homes and brokers. New tests use real in-process Pi sessions with a scripted faux provider (no API calls), a volatile conversation fixture, and owned temporary broker subprocesses. New broker tests set `HOME`, `USERPROFILE` and `PI_CODING_AGENT_DIR` before importing broker modules. They terminate only their own child processes. Source clones and dependency installation require network access; test model execution does not.

## Files

- `prototype/attention.ts`: FIFO snapshot posting at eligible busy/idle boundaries. Host readiness is **explicit fixture instrumentation**, not a universal modal detector. Idle pumping is explicit, not a production timer.
- `prototype/conversations.ts`: volatile exact peer approval and return handles. Approval is an owner-side function, never an agent tool. Inputs are typed fixtures, not a validated public protocol.
- `test/attention.test.ts`: native Pi turn/queue/history/permission/compaction tests and a scripted multi-turn handback.
- `test/conversations.test.ts`: overlaps, corrections, approvals, queue order, outbox and runtime loss.
- `test/transport.test.ts`, `test/exact-wire.ts`: real original broker behavior and frozen id+epoch protocol probes.

## Deliberately absent

No production broker build, package manifest for Pi loading, database, membership framework, automatic retry, UI monkey-patch, orchestration system, live-model trajectory, release or rollout. The fixture batch size of two is for testing overflow, **not product tuning**. Passing fixtures do not establish real human or model usability.

The lockfile retains the requested Pi 1.4.0 baseline. `npm audit` reports an inherited high-severity `undici` advisory; see the report. Do not treat this private test package as ready for deployment.
