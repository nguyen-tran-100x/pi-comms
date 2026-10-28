import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { gateCLimits } from '../prototype/gate-c-budget.ts';

// Preparation only: no providers, credentials, sockets, processes or model calls.
const root = '/tmp/pi-comms-spike/gate-c-20261028';
const manifest = path.join(root, 'destinations.json');
for (const name of ['coordinator', 'reviewer-a', 'reviewer-b', 'reviewer-c']) {
  const cwd = path.join(root, name, 'work');
  mkdirSync(cwd, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(cwd, 'detail.txt'), 'Synthetic detail: preserve exact session identity, buffer arrivals while paused, and report volatile state loss honestly.\n', { mode: 0o600 });
}
if (existsSync(manifest)) {
  const plan = JSON.parse(readFileSync(manifest, 'utf8'));
  if (!plan.runtimeAgentDir) {
    plan.runtimeAgentDir = mkdtempSync('/tmp/pcc-');
    writeFileSync(manifest, JSON.stringify(plan, null, 2) + '\n', { mode: 0o600 });
  }
  console.log(JSON.stringify(plan, null, 2));
} else {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const destinations = [];
  for (const name of ['coordinator', 'reviewer-a', 'reviewer-b', 'reviewer-c']) {
    const home = path.join(root, name);
    const cwd = path.join(home, 'work');
    const agentDir = path.join(home, 'agent');
    mkdirSync(cwd, { recursive: true, mode: 0o700 }); mkdirSync(agentDir, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(cwd, 'evidence.txt'), `Public synthetic Gate C evidence for ${name}.\nMemory queues lose state on restart; native IDs persist for saved sessions.\n`, { mode: 0o600 });
    const manager = SessionManager.create(cwd, path.join(home, 'sessions'));
    manager.appendMessage({ role: 'user', content: `Dedicated Gate C ${name}. Preparation only; no model call authorized yet.`, timestamp: Date.now() });
    manager.appendSessionInfo(`Gate C ${name}`);
    destinations.push({ name, sessionId: manager.getSessionId(), sessionFile: manager.getSessionFile(), cwd, home, agentDir });
  }
  const plan = { status: 'prepared-not-launched', root, runtimeAgentDir: mkdtempSync('/tmp/pcc-'), provider: 'openai', model: 'gpt-5.4-mini-2026-03-17', limits: gateCLimits, destinations };
  writeFileSync(manifest, JSON.stringify(plan, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(plan, null, 2));
}
