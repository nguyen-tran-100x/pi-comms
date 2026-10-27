import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';

// All imports that derive broker paths occur AFTER assigning the owned temporary home.
const home = mkdtempSync(path.join(tmpdir(), 'pc-home-'));
const agentDir = mkdtempSync('/tmp/pc-');
process.env.HOME = home; process.env.USERPROFILE = home; process.env.PI_CODING_AGENT_DIR = agentDir;
for (const key of ['PI_INTERCOM_SCOPE_ID', 'PI_INTERCOM_SESSION_ID', 'PI_SUBAGENT_ORCHESTRATOR_TARGET', 'PI_SUBAGENT_ORCHESTRATOR_SESSION_ID']) delete process.env[key];
const { IntercomClient } = await import('../.scratch/upstream/broker/client.ts');
const { conversations } = await import('../prototype/conversations.ts');
const { exactWire } = await import('./exact-wire.ts');

async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Transport fixture timed out'); await new Promise(r => setTimeout(r, 5)); }
}
async function start(): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['--import', 'tsx', '.scratch/upstream/broker/broker.ts'], { cwd: process.cwd(), env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const output: string[] = []; child.stdout!.on('data', b => output.push(b.toString())); child.stderr!.on('data', b => output.push(b.toString()));
  try { await waitFor(() => { if (child.exitCode !== null) throw new Error(output.join('')); return output.join('').includes('Intercom broker started'); }); }
  catch (error) { await stop(child); throw error; }
  return child;
}
async function stop(child: ChildProcess) { if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; } }
async function connect(name: string, id: string) {
  const client = new IntercomClient(); client.on('error', () => undefined);
  await client.connect({ name, cwd: process.cwd(), model: 'fixture-no-model', pid: process.pid, startedAt: Date.now(), lastActivity: Date.now() }, id);
  return client;
}

test('real isolated original broker: addressed send, dedupe, native ordinary-reply restriction and volatile mailbox restart', async () => {
  let broker = await start(); const clients: InstanceType<typeof IntercomClient>[] = [];
  try {
    const sender = await connect('coordinator', 'exact-sender'); clients.push(sender);
    let receiver = await connect('reviewer', 'exact-receiver'); clients.push(receiver);
    const similar = await connect('reviewer-similar', 'exact-similar'); clients.push(similar);
    const seen: any[] = [], wrong: any[] = [], returns: any[] = [];
    receiver.on('message', (from, message) => seen.push({ from, message }));
    similar.on('message', (from, message) => wrong.push({ from, message }));
    sender.on('message', (from, message) => returns.push({ from, message }));
    const first = await sender.send('exact-receiver', { messageId: 'ordinary', text: 'ordinary request' });
    assert.equal(first.delivered, true); await waitFor(() => seen.length === 1);
    const repeated = await sender.send('exact-receiver', { messageId: 'ordinary', text: 'ordinary request' });
    assert.equal(repeated.delivered, true); await new Promise(r => setTimeout(r, 20)); assert.equal(seen.length, 1);
    assert.equal(wrong.length, 0);
    const nativeReply = await receiver.send('exact-sender', { text: 'late answer', replyTo: 'ordinary' });
    assert.equal(nativeReply.delivered, false); assert.equal(nativeReply.code, 'E_REPLY_TARGET');

    const roster = await sender.listSessions();
    const endpoint = (id: string) => ({ id, epoch: roster.find(s => s.id === id)!.endpointEpoch! });
    const a = endpoint('exact-sender'), b = endpoint('exact-receiver');
    const tx = (client: InstanceType<typeof IntercomClient>) => async (to: typeof a, envelope: any) => {
      const live = (await client.listSessions()).find(s => s.id === to.id);
      if (!live || live.endpointEpoch !== to.epoch) return 'rejected' as const;
      // Runtime linkage is in the envelope; native replyTo is ask-only and deliberately omitted.
      const result = await client.send(to.id, { text: JSON.stringify(envelope), messageId: envelope.id });
      return result.delivered ? 'accepted' as const : result.outcomeKnown ? 'rejected' as const : 'unknown' as const;
    };
    const ca = conversations(a, tx(sender)), cb = conversations(b, tx(receiver)); ca.approveFromOwner(b); cb.approveFromOwner(a);
    const request = await ca.send({ to: b, subject: 'runtime', text: 'work across turns' });
    await waitFor(() => seen.length === 2);
    const handle = cb.receive(a, b, JSON.parse(seen[1].message.content.text))!;
    for (let turn = 0; turn < 4; turn++) await sender.listSessions();
    const answer = await cb.send({ respondTo: handle, text: 'runtime answer' });
    await waitFor(() => returns.length === 1);
    ca.receive(b, a, JSON.parse(returns[0].message.content.text));
    assert.equal(answer.replyTo, request.id); assert.equal(answer.exchange, request.exchange);

    await receiver.disconnect();
    await waitFor(() => !receiver.isConnected());
    const queued = await sender.send('exact-receiver', { messageId: 'mailbox', text: 'lost on broker restart' });
    assert.equal(queued.delivery, 'queued');
    await stop(broker); await waitFor(() => !sender.isConnected());
    broker = await start();
    const newSender = await connect('coordinator', 'exact-sender'); clients.push(newSender);
    receiver = await connect('reviewer', 'exact-receiver'); clients.push(receiver);
    const recovered: any[] = []; receiver.on('message', (from, message) => recovered.push({ from, message }));
    await new Promise(r => setTimeout(r, 100)); assert.equal(recovered.length, 0, 'broker mailbox was volatile');
    const afterRestart = await newSender.listSessions();
    const rebound = afterRestart.find(s => s.id === b.id)!;
    assert.notEqual(rebound.endpointEpoch, b.epoch);
    assert.equal((await tx(newSender)(b, { ...request, id: 'stale-attempt' })), 'rejected');
    const wire = await exactWire('frozen-wire-sender');
    try {
      assert.equal(await wire.send(b, { ...request, id: 'stale-on-wire' }), 'rejected');
      assert.equal(await wire.send({ id: rebound.id, epoch: rebound.endpointEpoch! }, { ...request, id: 'fresh-on-wire' }), 'accepted');
      await waitFor(() => recovered.length === 1);
      assert.equal(recovered[0].message.id, 'fresh-on-wire');
    } finally { wire.close(); }
    const stale = await newSender.send('absent-exact-id', { text: 'never use similar name' });
    assert.equal(stale.delivered, false); assert.equal(wrong.length, 0);
  } finally {
    await Promise.all(clients.map(c => c.disconnect().catch(() => undefined)));
    await stop(broker); rmSync(home, { recursive: true, force: true }); rmSync(agentDir, { recursive: true, force: true });
  }
});
