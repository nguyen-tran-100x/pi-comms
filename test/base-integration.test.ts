import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fauxProvider, fauxAssistantMessage } from '@earendil-works/pi-ai';
import { createAgentSessionRuntime, createAgentSessionServices, createAgentSessionFromServices, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { fileURLToPath } from 'node:url';
const extensionPath = process.env.PI_COMMS_TEST_EXTENSION ?? fileURLToPath(new URL('../dist/extension.js', import.meta.url));

const root = mkdtempSync(join(tmpdir(), 'pc-base-native-'));
// Set before dynamic broker imports; the bundled extension resolves paths at startup.
process.env.PI_CODING_AGENT_DIR = root;
const waitFor = async (predicate: () => boolean) => {
  const deadline = Date.now() + 8000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Native fixture timed out'); await new Promise(r => setTimeout(r, 10)); }
};
const text = (messages: any[]) => messages.map(m => typeof m.content === 'string' ? m.content : m.content?.map((b: any) => b.text ?? '').join('')).join('\n');
async function participant(label: string) {
  const dir = join(root, label); mkdirSync(dir);
  const faux = fauxProvider({ provider: `comms-base-${label}` });
  const models = await ModelRuntime.create({ authPath: join(root, `${label}-auth.json`), modelsPath: null, refreshOnCreate: false }); models.registerNativeProvider(faux.provider);
  const observed: any[][] = []; const notifications: string[] = [];
  let draft = ''; let confirm = true; let hold = false; const releases: (() => void)[] = [];
  faux.setResponses(Array.from({ length: 100 }, () => async context => {
    observed.push(structuredClone(context.messages));
    if (hold) await new Promise<void>(resolve => releases.push(resolve));
    return fauxAssistantMessage('fixture response');
  }));
  const manager = SessionManager.create(dir, join(root, 'sessions'));
  const factory = async ({ cwd, agentDir, sessionManager, sessionStartEvent }: any) => {
    const services = await createAgentSessionServices({ cwd, agentDir, modelRuntime: models, settingsManager: SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } }), resourceLoaderOptions: { noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, additionalExtensionPaths: [extensionPath] } });
    const created = await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent, model: faux.getModel(), noTools: 'builtin' });
    return { ...created, services, diagnostics: [] };
  };
  const runtime = await createAgentSessionRuntime(factory, { cwd: dir, agentDir: root, sessionManager: manager });
  const bind = async (session: any) => session.bindExtensions({ mode: 'tui', uiContext: { ...session.extensionRunner.getUIContext(), getEditorText: () => draft, notify: (message: string) => notifications.push(message), confirm: async () => confirm, input: async () => 'Base integration review', select: async (_title: string, choices: string[]) => choices[0], editor: async () => undefined } });
  await bind(runtime.session); runtime.setRebindSession(bind);
  const tool = async (name: string, input: unknown) => {
    const session = runtime.session; const runner = session.extensionRunner!;
    const definition = runner.getToolDefinition(name)!;
    return definition.execute(randomUUID(), input, undefined, undefined, runner.createToolContext(randomUUID(), undefined));
  };
  return { runtime, observed, notifications, tool, manager,
    id: () => runtime.session.sessionId,
    command: (args: string) => runtime.session.prompt(`/comms ${args}`),
    draft: (value: string) => { draft = value; }, confirm: (value: boolean) => { confirm = value; }, hold: (value: boolean) => { hold = value; },
    release: () => { releases.shift()?.(); },
    close: async () => { hold = false; releases.splice(0).forEach(r => r()); await runtime.session.abort(); await runtime.dispose(); },
  };
}
const data = (result: any) => result.structuredContent;

test('packaged extension: first-run approval, exact wire, delayed replies, Stop/Pause, native switch/resume/fork', async () => {
  let a: Awaited<ReturnType<typeof participant>> | undefined;
  let b: Awaited<ReturnType<typeof participant>> | undefined;
  try {
    a = await participant('coordinator'); b = await participant('reviewer');
    const aid = a.id(), bid = b.id();
    assert.match(a.notifications.join('\n'), /memory-only/);
    assert.deepEqual(data(await a.tool('comms_peers', {})).data.items, []);
    const all = data(await a.tool('comms_peers', { view: 'all' })).data.items;
    assert.ok(all.some((p: any) => p.id === bid && !p.approved));
    let denied = data(await a.tool('comms_message', { to: bid, subject: 'review', text: 'read only' }));
    assert.equal(denied.error.code, 'CONTACT_NOT_APPROVED');
    // Rejecting the actual human confirmation cannot be overridden by agent tool fields.
    a.confirm(false); await a.command(`approve ${bid}`);
    denied = data(await a.tool('comms_message', { to: bid, subject: 'review', text: 'read only' }));
    assert.equal(denied.error.code, 'CONTACT_NOT_APPROVED');
    a.confirm(true); await a.command(`approve ${bid}`);
    await b.command('pause');
    const sent = data(await a.tool('comms_message', { to: bid, subject: 'Design review', text: 'Inspect without editing; reply after tools.' }));
    assert.equal(sent.ok, true);
    await waitFor(() => b!.notifications.some(n => /Unapproved peer/.test(n)));
    assert.equal(b.observed.length, 0, 'unsolicited traffic did not wake model');
    await b.command(`approve ${aid}`);
    await new Promise(r => setTimeout(r, 200)); assert.equal(b.observed.length, 0, 'Pause held after approval');
    await b.command('resume'); await waitFor(() => b!.observed.length === 1 && b!.runtime.session.isIdle);
    assert.match(text(b.observed[0]), /subordinate to user directives/);
    const queue = data(await b.tool('comms_inspect', { message: sent.data.message.id })).data;
    assert.ok(queue.facts.some((f: any) => f.kind === 'posted'));
    assert.ok(queue.facts.some((f: any) => f.kind === 'saved'), 'observed native saved entry');
    const handle = queue.returnHandle;
    await b.runtime.session.prompt('human follow-up turn one');
    await b.runtime.session.prompt('human follow-up turn two');
    const reply = data(await b.tool('comms_message', { respondTo: handle, text: 'Findings after several turns and tool calls.' }));
    assert.equal(reply.ok, true); assert.equal(reply.data.message.replyTo, sent.data.message.id);
    await waitFor(() => a!.observed.some(messages => text(messages).includes('Findings after')));
    await a.runtime.session.waitForIdle();
    const inspected = data(await a.tool('comms_inspect', { message: sent.data.message.id })).data;
    assert.equal(inspected.responses.length, 1);
    // Draft at idle admission holds the full peer payload.
    b.draft('unsent human draft');
    const held = data(await a.tool('comms_message', { to: bid, subject: 'Draft boundary', text: 'held full payload' }));
    await new Promise(r => setTimeout(r, 350)); assert.equal(b.observed.length, 3);
    b.draft(''); await waitFor(() => b!.observed.length === 4 && b!.runtime.session.isIdle);
    assert.match(text(b.observed[3]), /held full payload/);
    // Several busy handbacks enter as one snapshot after already-pending native human input.
    b.hold(true);
    const busy = b.runtime.session.prompt('busy human work'); await waitFor(() => b!.observed.length === 5);
    await b.command('pause');
    await a.tool('comms_message', { to: bid, subject: 'Batch A', text: 'coherent finding A' });
    await a.tool('comms_message', { to: bid, subject: 'Batch B', text: 'coherent finding B' });
    await new Promise(r => setTimeout(r, 50));
    await b.runtime.session.prompt('pending human steering first', { streamingBehavior: 'steer' });
    await b.command('resume'); b.release(); await waitFor(() => b!.observed.length === 6);
    assert.match(text(b.observed[5]), /pending human steering first/);
    assert.doesNotMatch(text(b.observed[5]), /coherent finding A/);
    b.release(); await waitFor(() => b!.observed.length === 7);
    assert.match(text(b.observed[6]), /coherent finding A[\s\S]*coherent finding B/);
    await a.tool('comms_message', { to: bid, subject: 'Later C', text: 'later finding C' });
    await new Promise(r => setTimeout(r, 50)); b.release(); await waitFor(() => b!.observed.length === 8);
    assert.match(text(b.observed[7]), /later finding C/);
    b.hold(false); b.release(); await busy;
    const batchEntries = b.runtime.session.sessionManager.getEntries().filter(e => e.type === 'custom_message' && e.customType === 'comms_batch');
    assert.ok(batchEntries.some(e => (e.details as any).ids.length === 2));
    // Actual native Stop aborts current run; later peer traffic can wake it.
    b.hold(true); const run = b.runtime.session.prompt('human run to stop'); await waitFor(() => b!.observed.length === 9);
    const abort = b.runtime.session.abort(); b.release(); await abort; await run; b.hold(false);
    await a.tool('comms_message', { to: bid, subject: 'After Stop', text: 'later peer wake' });
    await waitFor(() => b!.observed.length === 10 && b!.runtime.session.isIdle);
    assert.match(text(b.observed[9]), /later peer wake/);
    await b.command('pause');
    await a.tool('comms_message', { to: bid, subject: 'Paused', text: 'buffered while paused' });
    await new Promise(r => setTimeout(r, 300)); assert.equal(b.observed.length, 10);
    await b.command('resume'); await waitFor(() => b!.observed.length === 11 && b!.runtime.session.isIdle);
    // Receive-only sessions reconnect themselves after their broker disappears.
    const brokerPid = Number(readFileSync(join(root, 'comms', 'broker.pid'), 'utf8'));
    process.kill(brokerPid, 'SIGTERM');
    await waitFor(() => a!.notifications.length > 0); // next check observes shared broker roster after backoff
    await new Promise(r => setTimeout(r, 1800));
    const afterRestart = data(await a.tool('comms_message', { to: bid, subject: 'After broker restart', text: 'receiver rejoined without a user tool call' }));
    assert.equal(afterRestart.ok, true);
    await waitFor(() => b!.runtime.session.isIdle && b!.observed.some(m => text(m).includes('receiver rejoined')));
    // Native runtime switch/new/resume retains saved identity, but clears volatile approval/linkage.
    const originalPath = b.runtime.session.sessionFile!;
    await b.runtime.newSession(); const newid = b.id(); assert.notEqual(newid, bid);
    assert.equal(data(await b.tool('comms_peers', {})).data.items.length, 0);
    const offline = data(await a.tool('comms_message', { to: bid, subject: 'Old session', text: 'must not reach new session' }));
    assert.equal(offline.ok, false);
    await b.runtime.switchSession(originalPath); assert.equal(b.id(), bid);
    assert.equal(data(await b.tool('comms_peers', {})).data.items.length, 0);
    assert.equal(data(await b.tool('comms_message', { respondTo: handle, text: 'lost linkage' })).error.code, 'CONTEXT_LOST');
    await b.command(`approve ${aid}`);
    const refreshed = data(await a.tool('comms_message', { to: bid, subject: 'Same saved session', text: 'fresh live connection, same public address' }));
    assert.equal(refreshed.ok, true);
    await waitFor(() => b!.runtime.session.isIdle && b!.observed.some(m => text(m).includes('fresh live connection')));
    const leaf = b.runtime.session.sessionManager.getBranch().find(e => e.type === 'message' && e.message.role === 'user');
    assert.ok(leaf);
    await b.runtime.fork(leaf.id); assert.notEqual(b.id(), bid);
    assert.equal(data(await b.tool('comms_peers', {})).data.items.length, 0);
    assert.match(b.notifications.join('\n'), /reset on reload\/switch\/restart/);
    assert.equal(data(await a.tool('comms_inspect', { message: held.data.message.id })).ok, true);
  } finally {
    await b?.close(); await a?.close();
    try { const pid = Number(readFileSync(join(root, 'comms', 'broker.pid'), 'utf8')); process.kill(pid, 'SIGTERM'); } catch {}
    await new Promise(r => setTimeout(r, 100)); rmSync(root, { recursive: true, force: true });
  }
});
