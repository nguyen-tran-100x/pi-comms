import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fauxProvider, fauxAssistantMessage } from '@earendil-works/pi-ai';
import { createAgentSessionRuntime, createAgentSessionServices, createAgentSessionFromServices, createReadTool, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
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
async function participant(label: string, interactive = true) {
  const dir = join(root, label); mkdirSync(dir);
  const faux = fauxProvider({ provider: `comms-base-${label}` });
  const models = await ModelRuntime.create({ authPath: join(root, `${label}-auth.json`), modelsPath: null, refreshOnCreate: false }); models.registerNativeProvider(faux.provider);
  const observed: any[][] = []; const notifications: string[] = []; const inspectedByHuman: string[] = []; const events: any[] = []; const widgetUpdates: unknown[] = [];
  const dialogs: { title: string; message: string }[] = [];
  let draft = ''; let confirm: boolean | ((opts?: { signal?: AbortSignal }) => Promise<boolean>) = false; let hold = false; const releases: (() => void)[] = [];
  faux.setResponses(Array.from({ length: 100 }, () => async context => {
    observed.push(structuredClone(context.messages));
    if (hold) await new Promise<void>(resolve => releases.push(resolve));
    return fauxAssistantMessage('fixture response');
  }));
  const manager = SessionManager.create(dir, join(root, 'sessions'));
  const factory = async ({ cwd, agentDir, sessionManager, sessionStartEvent }: any) => {
    const services = await createAgentSessionServices({ cwd, agentDir, modelRuntime: models, settingsManager: SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } }), resourceLoaderOptions: { noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, additionalExtensionPaths: [extensionPath] } });
    const created = await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent, model: faux.getModel(), noTools: 'builtin', customTools: [createReadTool(cwd)] });
    return { ...created, services, diagnostics: [] };
  };
  const runtime = await createAgentSessionRuntime(factory, { cwd: dir, agentDir: root, sessionManager: manager });
  const bind = async (session: any) => session.bindExtensions(interactive ? { mode: 'tui', uiContext: { ...session.extensionRunner.getUIContext(), getEditorText: () => draft, notify: (message: string) => notifications.push(message), setWidget: (_key: string, content: unknown) => { widgetUpdates.push(content); }, confirm: async (title: string, message: string, opts?: { signal?: AbortSignal }) => { dialogs.push({ title, message }); return typeof confirm === 'function' ? confirm(opts) : confirm; }, input: async () => 'Base integration review', select: async (_title: string, choices: string[]) => choices[0], editor: async (_title: string, value: string) => { inspectedByHuman.push(value); return undefined; } } } : { mode: 'print' });
  await bind(runtime.session); runtime.setRebindSession(bind);
  runtime.session.subscribe(event => events.push(event));
  const tool = async (name: string, input: unknown, signal?: AbortSignal) => {
    const session = runtime.session; const runner = session.extensionRunner!;
    const definition = runner.getToolDefinition(name)!;
    return definition.execute(randomUUID(), input, signal, undefined, runner.createToolContext(randomUUID(), signal));
  };
  return { runtime, observed, notifications, inspectedByHuman, dialogs, events, widgetUpdates, tool, manager, dir,
    responses: (responses: any[]) => faux.setResponses(responses.map(response => async (context: any) => { observed.push(structuredClone(context.messages)); return typeof response === 'function' ? response(context) : response; })),
    id: () => runtime.session.sessionId,
    command: (args: string) => runtime.session.prompt(`/comms ${args}`),
    draft: (value: string) => { draft = value; }, confirm: (value: typeof confirm) => { confirm = value; }, hold: (value: boolean) => { hold = value; },
    release: () => { releases.shift()?.(); },
    close: async () => { hold = false; releases.splice(0).forEach(r => r()); await runtime.session.abort(); await runtime.dispose(); },
  };
}
const data = (result: any) => result.structuredContent;

const call = (name: string, args: unknown) => ({ ...fauxAssistantMessage(''), stopReason: 'toolUse' as const, content: [{ type: 'toolCall' as const, id: randomUUID(), name, arguments: args }] });
const lastResult = (context: any, name: string) => {
  const result = context.messages.filter((m: any) => m.role === 'toolResult' && m.toolName === name).at(-1);
  assert.ok(result, `missing actual ${name} result`);
  return JSON.parse(text([result]));
};

test('first-contact approval continues the actual model/tool review without preapproval commands', async () => {
  let a: Awaited<ReturnType<typeof participant>> | undefined, b: Awaited<ReturnType<typeof participant>> | undefined;
  try {
    a = await participant('natural-coordinator'); b = await participant('natural-reviewer');
    let allowSend: ((allowed: boolean) => void) | undefined;
    a.confirm(opts => new Promise(resolve => { allowSend = resolve; opts?.signal?.addEventListener('abort', () => resolve(false), { once: true }); }));
    b.confirm(true);
    writeFileSync(join(b.dir, 'evidence.txt'), 'Natural review: first source.');
    writeFileSync(join(b.dir, 'detail.txt'), 'Natural review: second source.');
    b.responses([
      () => call('read', { path: 'evidence.txt' }),
      context => { assert.match(text(context.messages), /first source/); return call('read', { path: 'detail.txt' }); },
      context => {
        assert.match(text(context.messages), /second source/);
        const handle = text(context.messages).match(/return handle ([0-9a-f-]{36})/)![1];
        return call('comms_message', { respondTo: handle, text: 'NATURAL_REVIEW_FINDINGS' });
      },
      fauxAssistantMessage('Review returned.'),
    ]);
    a.responses([
      call('comms_peers', {}),
      context => { assert.deepEqual(lastResult(context, 'comms_peers').data.items, []); assert.match(lastResult(context, 'comms_peers').data.nextAction, /all/); return call('comms_peers', { view: 'all' }); },
      context => call('comms_message', { to: lastResult(context, 'comms_peers').data.items[0].id, subject: 'Read-only code review', text: 'Read evidence.txt and detail.txt, then return findings.' }),
      context => { assert.equal(lastResult(context, 'comms_message').ok, true); return fauxAssistantMessage('Request sent after user approval.'); },
      context => { assert.match(text(context.messages), /NATURAL_REVIEW_FINDINGS/); return fauxAssistantMessage('Findings assessed.'); },
    ]);
    const work = a.runtime.session.prompt('Have the reviewer review this work and return findings.');
    await waitFor(() => !!allowSend);
    assert.equal(b.observed.length, 0, 'nothing reaches recipient before sender human approval');
    assert.equal(data(await a.tool('comms_inspect', { outbox: 'self' })).data.items.length, 0);
    assert.match(a.dialogs[0].message, /Read-only code review/);
    assert.match(a.dialogs[0].message, /Yes continues this send automatically/);
    allowSend!(true); await work;
    await waitFor(() => a!.observed.some(m => text(m).includes('NATURAL_REVIEW_FINDINGS')) && a!.runtime.session.isIdle && b!.runtime.session.isIdle);
    assert.equal(a.dialogs.length, 1); assert.equal(b.dialogs.length, 1);
    assert.match(b.dialogs[0].title, /requesting collaboration/);
    assert.match(b.dialogs[0].message, /not yet shared with the agent/);
    assert.deepEqual(b.events.filter(e => e.type === 'tool_execution_end').map(e => e.toolName), ['read', 'read', 'comms_message']);
    const sent = data(await a.tool('comms_inspect', { outbox: 'self' })).data.items[0];
    assert.equal(sent.responses.length, 1);
    const response = data(await a.tool('comms_inspect', { message: sent.responses[0] })).data;
    assert.equal(response.message.replyTo, sent.message.id);
    assert.equal(response.message.exchange, sent.message.exchange);
  } finally { await b?.close(); await a?.close(); }
});

test('contact cancellation, no UI, incoming hold/reconsideration and Stop never self-approve or loop', async () => {
  let a: Awaited<ReturnType<typeof participant>> | undefined, b: Awaited<ReturnType<typeof participant>> | undefined, headless: Awaited<ReturnType<typeof participant>> | undefined;
  try {
    a = await participant('approval-sender'); b = await participant('approval-receiver');
    const input = { to: b.id(), subject: 'Read-only review', text: 'HELD_APPROVAL_CONTENT' };
    // Cancelling/refusing does not send, and agent retries do not re-prompt the person.
    for (let i = 0; i < 2; i++) assert.equal(data(await a.tool('comms_message', input)).error.code, 'CONTACT_NOT_APPROVED');
    assert.equal(a.dialogs.length, 1); assert.equal(b.observed.length, 0);
    assert.equal(data(await a.tool('comms_inspect', { outbox: 'self' })).data.items.length, 0);
    assert.equal(data(await a.tool('comms_peers', {})).data.items.length, 0);
    // Extension/model continuation is not a new human instruction and cannot re-prompt.
    a.responses([call('comms_message', input), fauxAssistantMessage('Still not approved.')]);
    await a.runtime.session.sendUserMessage('Try again');
    await a.runtime.session.waitForIdle(); assert.equal(a.dialogs.length, 1);
    // A real new user instruction can reconsider without a management command.
    a.confirm(true);
    a.responses([call('comms_message', input), fauxAssistantMessage('Sent after user approval.')]);
    await a.runtime.session.prompt('Go ahead with the review; I will allow the contact.');
    assert.equal(a.dialogs.length, 2);
    const sent = data(await a.tool('comms_inspect', { outbox: 'self' })).data.items[0];
    await waitFor(() => b!.dialogs.length === 1);
    await new Promise(r => setTimeout(r, 200));
    assert.equal(b.observed.length, 0);
    assert.doesNotMatch(JSON.stringify(data(await b.tool('comms_inspect', { queue: 'self' }))), /HELD_APPROVAL_CONTENT/);
    await a.tool('comms_message', { ...input, text: 'SECOND_HELD_CONTENT' });
    await new Promise(r => setTimeout(r, 200)); assert.equal(b.dialogs.length, 1, 'later arrivals do not repeat declined dialogs');
    b.confirm(true); await b.command('requests');
    await waitFor(() => b!.observed.some(m => text(m).includes('HELD_APPROVAL_CONTENT')) && b!.runtime.session.isIdle);
    assert.match(text(b.observed[0]), /SECOND_HELD_CONTENT/);
    assert.match(data(await b.tool('comms_peers', {})).data.items[0].context, /peer-supplied title; user directives remain controlling/);
    const widgetCount = b.widgetUpdates.length;
    await new Promise(r => setTimeout(r, 340)); assert.equal(b.widgetUpdates.length, widgetCount, 'unchanged state does not rebuild native widgets every timer tick');
    // Native tool context without a human UI rejects, never guesses consent.
    headless = await participant('approval-headless', false);
    const refused = data(await headless.tool('comms_message', { ...input, to: a.id() }));
    assert.equal(refused.error.code, 'CONTACT_APPROVAL_REQUIRED');
    assert.equal(data(await headless.tool('comms_inspect', { outbox: 'self' })).data.items.length, 0);
    // Stop while the native approval dialog is open cancels it and prevents send/approval.
    const controller = new AbortController(); let deciding = false;
    a.confirm(opts => new Promise(resolve => { deciding = true; opts?.signal?.addEventListener('abort', () => resolve(false), { once: true }); }));
    const stopped = a.tool('comms_message', { ...input, to: headless.id() }, controller.signal);
    await waitFor(() => deciding); controller.abort();
    assert.equal(data(await stopped).error.code, 'CONTACT_CANCELLED');
    assert.ok(!data(await a.tool('comms_peers', {})).data.items.some((p: any) => p.id === headless!.id()));
    // Native Stop also aborts the tool's own signal and dismisses its approval dialog.
    deciding = false;
    a.responses([call('comms_message', { ...input, to: headless.id() }), fauxAssistantMessage('stopped')]);
    const run = a.runtime.session.prompt('Ask the new colleague for this review.');
    await waitFor(() => deciding); await a.runtime.session.abort(); await run;
    assert.ok(!data(await a.tool('comms_peers', {})).data.items.some((p: any) => p.id === headless!.id()));
    assert.ok(!data(await a.tool('comms_inspect', { outbox: 'self' })).data.items.some((e: any) => e.message.to === headless!.id()));
    assert.equal(data(await a.tool('comms_inspect', { message: sent.message.id })).ok, true);
  } finally { await headless?.close(); await b?.close(); await a?.close(); }
});

test('cancelling an outgoing send does not silently answer a later incoming contact decision', async () => {
  let a: Awaited<ReturnType<typeof participant>> | undefined, b: Awaited<ReturnType<typeof participant>> | undefined;
  try {
    a = await participant('direction-a'); b = await participant('direction-b');
    const denied = data(await a.tool('comms_message', { to: b.id(), subject: 'Outbound', text: 'cancel this send' }));
    assert.equal(denied.error.code, 'CONTACT_NOT_APPROVED'); assert.equal(a.dialogs.length, 1);
    b.confirm(true);
    assert.equal(data(await b.tool('comms_message', { to: a.id(), subject: 'Incoming', text: 'a different incoming request' })).ok, true);
    await waitFor(() => a!.dialogs.length === 2);
    assert.match(a.dialogs[1].title, /requesting collaboration/);
    assert.equal(a.observed.length, 0, 'new incoming prompt did not imply consent or admit content');
    assert.doesNotMatch(JSON.stringify(data(await a.tool('comms_inspect', { queue: 'self' }))), /a different incoming request/);
  } finally { await b?.close(); await a?.close(); }
});

test('incoming contact prompt respects drafts/Pause and lifetime replacement cannot grant approval', async () => {
  let a: Awaited<ReturnType<typeof participant>> | undefined, b: Awaited<ReturnType<typeof participant>> | undefined;
  try {
    a = await participant('boundary-sender'); b = await participant('boundary-receiver');
    assert.equal(data(await a.tool('comms_message', { to: 'Reviewer', subject: 'invalid', text: 'not an exact address' })).error.code, 'INVALID_INPUT');
    assert.equal(a.dialogs.length, 0, 'invalid input never asks the person to approve');
    let allow: ((value: boolean) => void) | undefined;
    a.confirm(() => new Promise(resolve => { allow = resolve; })); b.confirm(true); b.draft('human draft');
    const sends = Promise.all([
      a.tool('comms_message', { to: b.id(), subject: 'Review boundary', text: 'draft-held request' }),
      a.tool('comms_message', { to: b.id(), subject: 'Review boundary', text: 'second concurrent request' }),
    ]);
    await waitFor(() => !!allow); assert.equal(a.dialogs.length, 1, 'parallel sends share one human decision');
    allow!(true); const results = await sends; assert.ok(results.every(result => data(result).ok));
    await new Promise(r => setTimeout(r, 220)); assert.equal(b.dialogs.length, 0);
    assert.equal(b.observed.length, 0);
    await b.command('pause'); b.draft('');
    await new Promise(r => setTimeout(r, 220)); assert.equal(b.dialogs.length, 0);
    await b.command('resume');
    await waitFor(() => b!.dialogs.length === 1 && b!.observed.length === 1 && b!.runtime.session.isIdle);
    // An approval dialog from the invalidated session cannot approve the replacement.
    await b.runtime.newSession();
    let deciding = false;
    a.confirm(opts => new Promise(resolve => { deciding = true; opts?.signal?.addEventListener('abort', () => resolve(true), { once: true }); }));
    const pending = a.tool('comms_message', { to: b.id(), subject: 'New saved session', text: 'must not survive switch' });
    await waitFor(() => deciding);
    await a.runtime.newSession();
    assert.equal(data(await pending).error.code, 'CONTACT_CANCELLED');
    assert.deepEqual(data(await a.tool('comms_peers', {})).data.items, []);
    assert.deepEqual(data(await a.tool('comms_inspect', { outbox: 'self' })).data.items, []);
  } finally { await b?.close(); await a?.close(); }
});

test('installed Base model tools: private inspection boundary and discover → send → two reads → contextual reply', async () => {
  let a: Awaited<ReturnType<typeof participant>> | undefined, b: Awaited<ReturnType<typeof participant>> | undefined;
  try {
    a = await participant('tool-coordinator'); b = await participant('tool-reviewer');
    // Select through the normal human selector, rather than supplying an ID.
    a.confirm(true); await a.command('approve');
    const privateMessage = data(await a.tool('comms_message', { to: b.id(), subject: 'PRIVATE_SUBJECT', text: 'PRIVATE_BODY', refs: [{ uri: 'file:///PRIVATE_REFERENCE', label: 'PRIVATE_LABEL' }] })).data;
    await waitFor(() => b!.notifications.some(n => /Contact request from/.test(n)));
    assert.equal(b.observed.length, 0);
    await b.command(`inspect ${privateMessage.message.id}`);
    assert.match(b.inspectedByHuman.at(-1)!, /PRIVATE_BODY/);
    const privateHandle = JSON.parse(b.inspectedByHuman.at(-1)!).returnHandle;
    b.responses([
      call('comms_inspect', { queue: 'self' }), call('comms_inspect', { message: privateMessage.message.id }), call('comms_inspect', { exchange: privateMessage.message.exchange }), fauxAssistantMessage('Held for human approval.'),
    ]);
    await b.runtime.session.prompt('Inspect waiting metadata only.');
    for (const request of b.observed) {
      assert.doesNotMatch(text(request), /PRIVATE_/);
      assert.ok(!JSON.stringify(request).includes(privateHandle));
    }
    assert.match(text(b.observed.at(-1)!), /CONTACT_NOT_APPROVED/);
    // Approve while paused: metadata-only inspection changes to complete evidence, without automatic intake.
    await b.command('pause'); b.confirm(true); await b.command('approve');
    assert.match(JSON.stringify(data(await b.tool('comms_inspect', { message: privateMessage.message.id }))), /PRIVATE_BODY/);
    b.responses([fauxAssistantMessage('No reply required for the earlier message.')]);
    await b.command('resume'); await waitFor(() => b!.runtime.session.isIdle && b!.observed.some(m => text(m).includes('PRIVATE_BODY')));
    writeFileSync(join(b.dir, 'evidence.txt'), 'Evidence alpha: preserve exact session identity.');
    writeFileSync(join(b.dir, 'detail.txt'), 'Evidence beta: no durable queue required.');
    b.responses([
      context => { assert.match(text(context.messages), /return handle [0-9a-f-]{36}/); return call('read', { path: 'evidence.txt' }); },
      context => { assert.match(text(context.messages), /Evidence alpha/); return call('read', { path: 'detail.txt' }); },
      context => {
        assert.match(text(context.messages), /Evidence beta/);
        const batch = context.messages.filter((m: any) => text([m]).includes('Model tool review') && text([m]).includes('return handle')).at(-1);
        assert.ok(batch, 'request context supplies return handle');
        const handle = text([batch]).match(/return handle ([0-9a-f-]{36})/)![1];
        return call('comms_message', { respondTo: handle, text: 'MODEL_FINDINGS: exact identity and volatile state verified.' });
      },
      context => { assert.equal(lastResult(context, 'comms_message').ok, true); return fauxAssistantMessage('Review returned.'); },
    ]);
    a.responses([
      call('comms_peers', {}),
      context => { const peers = lastResult(context, 'comms_peers').data.items; assert.equal(peers[0].id, b!.id()); assert.equal(peers[0].approved, true); return call('comms_message', { to: peers[0].id, subject: 'Model tool review', text: 'Read evidence.txt and detail.txt, then return findings using the supplied handle.' }); },
      context => { assert.equal(lastResult(context, 'comms_message').ok, true); return fauxAssistantMessage('Waiting for the review.'); },
      context => { assert.match(text(context.messages), /MODEL_FINDINGS/); return fauxAssistantMessage('Linked findings received.'); },
    ]);
    await a.runtime.session.prompt('Find the approved reviewer and request the two-file review.');
    await waitFor(() => a!.observed.some(m => text(m).includes('MODEL_FINDINGS')) && a!.runtime.session.isIdle && b!.runtime.session.isIdle);
    const aTools = a.events.filter(e => e.type === 'tool_execution_end').map(e => e.toolName);
    const bTools = b.events.filter(e => e.type === 'tool_execution_end').map(e => e.toolName);
    assert.deepEqual(aTools, ['comms_peers', 'comms_message']);
    assert.deepEqual(bTools, ['comms_inspect', 'comms_inspect', 'comms_inspect', 'read', 'read', 'comms_message']);
    assert.ok(b.events.filter(e => e.type === 'tool_execution_end').every(e => !e.isError));
    const sent = data(await a.tool('comms_inspect', { outbox: 'self' })).data.items.find((e: any) => e.message.subject === 'Model tool review');
    assert.equal(sent.responses.length, 1);
    const reply = data(await a.tool('comms_inspect', { message: sent.responses[0] })).data;
    assert.equal(reply.message.replyTo, sent.message.id); assert.equal(reply.message.exchange, sent.message.exchange);
    assert.match(reply.message.text, /MODEL_FINDINGS/);
    // Two installed-runtime exchanges remain distinct through interleaved clarification and correction.
    await a.command('pause'); await b.command('pause');
    const first = data(await a.tool('comms_message', { to: b.id(), subject: 'Overlap X', text: 'Review X' })).data.message;
    const second = data(await a.tool('comms_message', { to: b.id(), subject: 'Overlap Y', text: 'Review Y' })).data.message;
    await new Promise(r => setTimeout(r, 30));
    const atB = async (message: string) => data(await b!.tool('comms_inspect', { message })).data;
    const atA = async (message: string) => data(await a!.tool('comms_inspect', { message })).data;
    const clarify = data(await b.tool('comms_message', { respondTo: (await atB(first.id)).returnHandle, text: 'Clarify X?' })).data.message;
    const answerY = data(await b.tool('comms_message', { respondTo: (await atB(second.id)).returnHandle, text: 'Y initial finding' })).data.message;
    await new Promise(r => setTimeout(r, 30));
    const clarification = data(await a.tool('comms_message', { respondTo: (await atA(clarify.id)).returnHandle, text: 'X clarification' })).data.message;
    const correctedY = data(await b.tool('comms_message', { respondTo: (await atB(second.id)).returnHandle, text: 'Y corrected finding', corrects: answerY.id })).data.message;
    await new Promise(r => setTimeout(r, 30));
    const answerX = data(await b.tool('comms_message', { respondTo: (await atB(clarification.id)).returnHandle, text: 'X final finding' })).data.message;
    await new Promise(r => setTimeout(r, 30));
    const x = data(await a.tool('comms_inspect', { exchange: first.exchange })).data.items;
    const y = data(await a.tool('comms_inspect', { exchange: second.exchange })).data.items;
    assert.deepEqual(x.map((e: any) => e.message.id), [first.id, clarify.id, clarification.id, answerX.id]);
    assert.deepEqual(y.map((e: any) => e.message.id), [second.id, answerY.id, correctedY.id]);
    assert.equal(correctedY.corrects, answerY.id); assert.equal(answerX.replyTo, clarification.id);
    // Verify the production envelope-to-card projection, not only hand-authored renderer inputs.
    a.responses([fauxAssistantMessage('Review evidence received; no further reply needed.')]);
    await a.command('resume'); await waitFor(() => a!.runtime.session.isIdle && a!.runtime.session.sessionManager.getEntries().some(e => e.type === 'custom_message' && (e.details as any)?.messages?.some((m: any) => m.id === correctedY.id)));
    const correctionCard = a.runtime.session.sessionManager.getEntries().flatMap(e => e.type === 'custom_message' ? (e.details as any)?.messages ?? [] : []).find((m: any) => m.id === correctedY.id);
    assert.equal(correctionCard.corrects, answerY.id);
    // Local broker connectivity is not counterpart presence.
    await b.runtime.newSession();
    assert.equal(data(await a.tool('comms_peers', {})).data.items.find((p: any) => p.id === sent.message.to).presence, 'offline');
    const inspected = data(await a.tool('comms_inspect', { message: sent.message.id })).data;
    assert.equal(inspected.localTransport.connectivity, 'online');
    assert.equal(inspected.current, undefined);
    const queue = data(await a.tool('comms_inspect', { queue: 'self' })).data;
    assert.equal(queue.localTransport.connectivity, 'online'); assert.equal(queue.current, undefined);
  } finally { await b?.close(); await a?.close(); }
});

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
    await waitFor(() => b!.notifications.some(n => /Contact request from/.test(n)));
    assert.equal(b.observed.length, 0, 'unsolicited traffic did not wake model');
    b.confirm(true); await b.command(`approve ${aid}`);
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
    b.confirm(true); await b.command(`approve ${aid}`);
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
