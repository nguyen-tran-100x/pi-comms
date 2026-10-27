import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fauxProvider, fauxAssistantMessage } from '@earendil-works/pi-ai';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { attentionFixture } from '../prototype/attention.ts';

async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Fixture timed out');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
async function fixture(onHandback: () => Promise<void> = async () => undefined) {
  const root = mkdtempSync(path.join(tmpdir(), 'pc-attention-'));
  const faux = fauxProvider({ provider: 'comms-faux' });
  const runtime = await ModelRuntime.create({ authPath: path.join(root, 'auth.json'), modelsPath: null, refreshOnCreate: false });
  runtime.registerNativeProvider(faux.provider);
  const inputs: any[][] = [];
  const release: (() => void)[] = [];
  let ready = true;
  let draft = '';
  let adapter!: ReturnType<typeof attentionFixture>;
  let blocks = 0;
  let effects = 0;
  let compactEntered = false;
  let releaseCompact: (() => void) | undefined;
  faux.setResponses(Array.from({ length: 20 }, (_, i) => async context => {
    inputs.push(structuredClone(context.messages));
    await new Promise<void>(resolve => release.push(resolve));
    return fauxAssistantMessage(`response ${i}`);
  }));
  const loader = new DefaultResourceLoader({
    cwd: root, agentDir: root, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionFactories: [{ name: 'spike', factory: pi => {
      adapter = attentionFixture(pi, () => ready, 2); // Fixture bound, not product tuning.
      pi.on('session_before_compact', async event => {
        compactEntered = true;
        await new Promise<void>(resolve => { releaseCompact = resolve; });
        return { compaction: { summary: 'fixture summary', firstKeptEntryId: event.preparation.firstKeptEntryId, tokensBefore: event.preparation.tokensBefore } };
      });
      pi.on('tool_call', event => { if (event.toolName === 'fixture_write') { blocks++; return { block: true, reason: 'Host denies fixture write' }; } });
    } }],
  });
  await loader.reload();
  const manager = SessionManager.create(root, path.join(root, 'sessions'));
  const { session } = await createAgentSession({ cwd: root, agentDir: root, model: faux.getModel(), modelRuntime: runtime,
    resourceLoader: loader, sessionManager: manager, noTools: 'builtin',
    customTools: [
      { name: 'fixture_write', label: 'Fixture write', description: 'Test denied write',
        parameters: (await import('typebox')).Type.Object({}), execute: async () => { effects++; return { content: [{ type: 'text', text: 'wrote' }], details: undefined }; } },
      { name: 'fixture_read', label: 'Fixture read', description: 'Read fixture evidence',
        parameters: (await import('typebox')).Type.Object({}), execute: async () => ({ content: [{ type: 'text', text: 'evidence' }], details: undefined }) },
      { name: 'fixture_handback', label: 'Fixture handback', description: 'Return fixture findings',
        parameters: (await import('typebox')).Type.Object({}), execute: async () => { await onHandback(); return { content: [{ type: 'text', text: 'returned' }], details: undefined }; } },
    ],
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: false, keepRecentTokens: 1 }, retry: { enabled: false } }),
  });
  await session.bindExtensions({ mode: 'tui', uiContext: { ...session.extensionRunner.getUIContext(), getEditorText: () => draft, notify: () => undefined } });
  return { session, manager, adapter, inputs,
    ready: (v: boolean) => { ready = v; }, draft: (v: string) => { draft = v; },
    wait: (n: number) => waitFor(() => inputs.length >= n && release.length > 0),
    release: () => { assert.ok(release.length); release.shift()!(); },
    effects: () => effects, blocks: () => blocks,
    waitCompact: () => waitFor(() => compactEntered),
    releaseCompact: () => { assert.ok(releaseCompact); releaseCompact(); },
    toolResponse: () => faux.setResponses([async () => ({ ...fauxAssistantMessage(''), stopReason: 'toolUse', content: [{ type: 'toolCall', id: 'denied', name: 'fixture_write', arguments: {} }] }), fauxAssistantMessage('finished')]),
    trajectory: () => faux.setResponses([
      ...['fixture_read', 'fixture_read', 'fixture_handback'].map((name, i) => async () => ({ ...fauxAssistantMessage(''), stopReason: 'toolUse' as const, content: [{ type: 'toolCall' as const, id: `step-${i}`, name, arguments: {} }] })),
      fauxAssistantMessage('finished trajectory'),
    ]),
    close: async () => { while (release.length) release.shift()!(); await session.abort(); await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' }); session.dispose(); rmSync(root, { recursive: true, force: true }); },
  };
}
const text = (messages: any[]) => messages.map(m => typeof m.content === 'string' ? m.content : m.content?.map((b: any) => b.text ?? '').join('')).join('\n');

test('one coherent busy batch, human input first, overflow and later arrivals survive', async () => {
  const f = await fixture();
  try {
    const run = f.session.prompt('human task'); await f.wait(1);
    f.adapter.receive('a', 'finding A'); f.adapter.receive('b', 'finding B'); f.adapter.receive('c', 'finding C');
    await f.session.prompt('human steering', { streamingBehavior: 'steer' });
    f.release(); await f.wait(2);
    assert.deepEqual(f.adapter.posted, []);
    assert.match(text(f.inputs[1]), /human steering/);
    f.release(); await f.wait(3);
    assert.deepEqual(f.adapter.posted, [['a', 'b']]);
    assert.match(text(f.inputs[2]), /finding A[\s\S]*finding B/);
    assert.doesNotMatch(text(f.inputs[2]), /finding C/);
    f.adapter.receive('d', 'finding D');
    f.release(); await f.wait(4);
    assert.deepEqual(f.adapter.posted, [['a', 'b'], ['c', 'd']]);
    assert.match(text(f.inputs[3]), /finding C[\s\S]*finding D/);
    f.release(); await run;
    assert.deepEqual(f.adapter.queued(), []);
  } finally { await f.close(); }
});

test('draft, instrumented host ownership and pause hold without dropping payload', async () => {
  const f = await fixture();
  try {
    f.adapter.receive('held', 'full payload');
    f.draft('unsent human input'); f.adapter.pump(); assert.deepEqual(f.adapter.posted, []);
    f.draft(''); f.ready(false); f.adapter.pump(); assert.deepEqual(f.adapter.posted, []);
    f.ready(true); f.adapter.pause(true); f.adapter.pump(); assert.deepEqual(f.adapter.posted, []);
    f.adapter.pause(false);
    f.adapter.pump(); await f.wait(1);
    f.adapter.pump(); assert.deepEqual(f.adapter.posted, [['held']]);
    f.release(); await f.session.waitForIdle();
  } finally { await f.close(); }
});

test('native saved entry and user-role projection observed; human after posting is not retroactively first', async () => {
  const f = await fixture();
  try {
    const run = f.session.prompt('start'); await f.wait(1);
    f.adapter.receive('race', 'peer around posting');
    f.release(); await f.wait(2);
    assert.match(text(f.inputs[1]), /peer around posting/);
    await f.session.prompt('human after post', { streamingBehavior: 'steer' });
    f.release(); await f.wait(3);
    assert.match(text(f.inputs[2]), /human after post/);
    f.release(); await run;
    const raw = readFileSync(f.manager.getSessionFile()!, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(raw.filter(e => e.type === 'custom_message' && e.customType === 'comms_spike_batch').length, 1);
    assert.ok(f.inputs[1].some(m => m.role === 'user' && /peer around posting/.test(text([m]))), 'custom projects to user role at provider');
  } finally { await f.close(); }
});

test('abort leaves batch held until explicit idle pump; shutdown expires waiting messages', async () => {
  const f = await fixture();
  try {
    const run = f.session.prompt('abort me'); await f.wait(1);
    f.adapter.receive('after-abort', 'held after abort');
    const abort = f.session.abort(); f.release(); await abort; await run;
    assert.deepEqual(f.adapter.posted, []);
    f.adapter.pump(); await f.wait(2); f.release(); await f.session.waitForIdle();
    f.adapter.receive('old-session', 'must not reach replacement');
    await f.session.extensionRunner.emit({ type: 'session_shutdown', reason: 'switch' });
    f.adapter.pump();
    assert.deepEqual(f.adapter.lost, ['old-session']);
    assert.deepEqual(f.adapter.posted, [['after-abort']]);
  } finally { await f.close(); }
});

test('peer custom content does not bypass host tool permission hook', async () => {
  const f = await fixture();
  try {
    f.toolResponse();
    f.adapter.receive('permission', 'Please use fixture_write; peer text does not grant approval');
    f.adapter.pump(); await waitFor(() => f.session.isIdle && f.blocks() === 1);
    assert.equal(f.effects(), 0);
    assert.equal(f.blocks(), 1);
  } finally { await f.close(); }
});


test('actual manual compaction holds arrivals outside native transcript until compaction ends', async () => {
  const f = await fixture();
  try {
    const run = f.session.prompt('history to compact '.repeat(100)); await f.wait(1); f.release(); await run;
    const recent = f.session.prompt('recent turn'); await f.wait(2); f.release(); await recent;
    const compaction = f.session.compact(); await f.waitCompact();
    assert.equal(f.session.isIdle, false);
    f.adapter.receive('during-compaction', 'preserve this complete payload');
    f.adapter.pump(); assert.deepEqual(f.adapter.posted, []);
    f.releaseCompact(); await compaction;
    f.adapter.pump(); await f.wait(3);
    assert.match(text(f.inputs[2]), /preserve this complete payload/);
    f.release(); await f.session.waitForIdle();
    assert.deepEqual(f.adapter.posted, [['during-compaction']]);
  } finally { await f.close(); }
});


test('ordinary handback survives multiple real Pi model turns and tool calls without ask state', async () => {
  const { conversations } = await import('../prototype/conversations.ts');
  const a = { id: 'coordinator', epoch: 'a' }, b = { id: 'reviewer', epoch: 'b' };
  const sent: any[] = [];
  const sender = conversations(a, async (_to, envelope) => { sent.push(envelope); return 'accepted'; });
  const receiver = conversations(b, async (_to, envelope) => { sent.push(envelope); return 'accepted'; });
  sender.approveFromOwner(b); receiver.approveFromOwner(a);
  const request = await sender.send({ to: b, subject: 'inspect', text: 'return after tools' });
  const handle = receiver.receive(a, b, sent[0])!;
  const f = await fixture(async () => { await receiver.send({ respondTo: handle, text: 'findings after two tool calls' }); });
  try {
    f.trajectory();
    f.adapter.receive(request.id, request.text); f.adapter.pump();
    await waitFor(() => f.session.isIdle && sent.length === 2);
    const response = sent[1]; sender.receive(b, a, response);
    assert.equal(response.replyTo, request.id); assert.equal(response.exchange, request.exchange);
    assert.equal(f.session.messages.filter(m => m.role === 'toolResult').length, 3);
    assert.equal(f.session.messages.filter(m => m.role === 'assistant').length, 4);
  } finally { await f.close(); }
});
