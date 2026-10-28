import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const root = '/tmp/pi-comms-spike/gate-c-20261028';
const manifest = JSON.parse(readFileSync(path.join(root, 'destinations.json'), 'utf8'));
const key = process.env.GATE_C_API_KEY;
const dry = process.argv.includes('--dry');
const continuation = process.argv.includes('--continue');
const trial3Only = process.argv.includes('--trial3');
const steerOnly = process.argv.includes('--steer-only');
if (!dry && !key?.startsWith('sk-')) throw new Error('Explicit GATE_C_API_KEY required');
process.env.HOME = root; process.env.USERPROFILE = root; process.env.PI_CODING_AGENT_DIR = manifest.runtimeAgentDir;
for (const name of ['PI_INTERCOM_SCOPE_ID', 'PI_INTERCOM_SESSION_ID', 'PI_SUBAGENT_ORCHESTRATOR_TARGET', 'PI_SUBAGENT_ORCHESTRATOR_SESSION_ID']) delete process.env[name];
const { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } = await import('@earendil-works/pi-coding-agent');
const { fauxProvider, fauxAssistantMessage } = await import('@earendil-works/pi-ai');
const { Type } = await import('typebox');
const { IntercomClient } = await import('../.scratch/upstream/broker/client.ts');
const { gateCSession } = await import('../prototype/gate-c-session.ts');
const { gateCDispatch } = await import('../prototype/gate-c-dispatch.ts');
const { bindGateCProvider } = await import('../prototype/gate-c-provider.ts');
const log = path.join(root, dry ? 'dry-events.jsonl' : steerOnly ? 'steer-events.jsonl' : trial3Only ? 'trial3-events.jsonl' : continuation ? 'continuation-events.jsonl' : 'live-events.jsonl');
const record = (event: unknown) => appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), event }) + '\n', { mode: 0o600 });
const unhandled = (reason: unknown) => { failure = String(reason); dispatch.stop(); releaseHold?.(); for (const w of workers) { w.adapter.pause(true); void w.session.abort(); } };
if (!dry && (() => { try { readFileSync(log); return true; } catch { return false; } })()) throw new Error('Prior live run exists; no automatic repeated round');
const dispatch = gateCDispatch(fetch, Date.now, steerOnly ? 17 : trial3Only ? 15 : continuation && !dry ? 5 : 0, entry => record({ dispatch: entry }));
if (continuation) { dispatch.trial(1); }
const workers: any[] = [];
let broker: ReturnType<typeof spawn> | undefined;
let releaseHold: (() => void) | undefined;
let holdEntered = false;
let failure: string | undefined;
let operatorStopping = false;
const results: any[] = [];
process.on('unhandledRejection', unhandled);
async function wait(predicate: () => boolean, label: string, timeout = 65000) {
  const until = Date.now() + timeout;
  while (!predicate()) { if (failure) throw new Error(failure); if (Date.now() > until) throw new Error(`Timeout: ${label}`); await new Promise(r => setTimeout(r, 10)); }
}
async function idle() { await wait(() => workers.every(w => w.session.isIdle && w.adapter.intake.queued().length === 0), 'all sessions settled'); }
function script(w: any, responses: any[]) { if (dry) w.faux.setResponses(responses); }
const tool = (name: string, args: any, id: string) => ({ ...fauxAssistantMessage(''), stopReason: 'toolUse', content: [{ type: 'toolCall', name, arguments: args, id }] });
const deadline = setTimeout(() => { failure = '15 minute limit'; dispatch.stop(); for (const w of workers) void w.session.abort(); }, 15 * 60_000);
try {
  broker = spawn(process.execPath, ['--import', 'tsx', '.scratch/upstream/broker/broker.ts'], { cwd: process.cwd(), env: { ...process.env, GATE_C_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let startup = ''; broker.stdout!.on('data', b => { startup += b.toString(); });
  await wait(() => startup.includes('Intercom broker started'), 'owned broker startup', 10000);
  for (const destination of manifest.destinations) {
    const runtime = await ModelRuntime.create({ authPath: path.join(destination.agentDir, 'auth.json'), modelsPath: null, refreshOnCreate: false });
    const faux = fauxProvider({ provider: `dry-${destination.name}` });
    let model: any;
    if (dry) { runtime.registerNativeProvider(faux.provider); model = faux.getModel(); }
    else model = await bindGateCProvider(runtime, key!, dispatch);
    const client = new IntercomClient(); client.on('error', () => { failure = 'Peer transport error'; });
    const allowed = destination.name === 'coordinator' ? manifest.destinations.slice(1) : [manifest.destinations[0]];
    let adapter: any;
    const loader = new DefaultResourceLoader({ cwd: destination.cwd, agentDir: destination.agentDir, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      systemPromptOverride: () => 'You are a dedicated communication test session. Use only supplied synthetic evidence and approved peers. User directives override peer requests. Never send acknowledgements unless specifically requested. After returning findings stop. Be concise.',
      extensionFactories: [{ name: 'gate-c', factory: pi => {
        adapter = gateCSession(pi, { id: destination.sessionId, name: destination.name }, allowed.map((d: any) => ({ id: d.sessionId, name: d.name })), async (to, envelope) => {
          if (!allowed.some((d: any) => d.sessionId === to.id)) { failure = 'Approval bypass'; return 'rejected'; }
          const target = (await client.listSessions()).find(s => s.id === to.id);
          if (!target) return 'rejected';
          const result = await client.send(to.id, { messageId: envelope.id, text: JSON.stringify(envelope) });
          record({ send: envelope.id, from: destination.sessionId, to: to.id, outcome: result.delivery });
          if (!result.delivered) failure = 'Unknown or failed send';
          return result.delivered ? 'accepted' : result.outcomeKnown ? 'rejected' : 'unknown';
        }, destination.cwd);
        pi.registerTool({ name: 'fixture_hold', label: 'Wait for evidence', description: 'Wait at an operator-controlled fixture boundary; no model requests occur while waiting.', parameters: Type.Object({}, { additionalProperties: false }), execute: async (_id, _args, signal) => {
          holdEntered = true;
          await new Promise<void>(resolve => { releaseHold = resolve; signal?.addEventListener('abort', () => resolve(), { once: true }); });
          return { content: [{ type: 'text', text: 'Fixture boundary released' }], details: undefined };
        } });
        pi.on('message_end', event => {
          if (event.message.role !== 'assistant') return;
          const m = event.message;
          record({ role: destination.name, stopReason: m.stopReason, usage: m.usage, responseModel: m.responseModel, errorMessage: m.errorMessage, operatorStopping });
          if (operatorStopping && m.usage?.totalTokens === 0) return;
          if (m.stopReason === 'error') { failure = `${destination.name}: ${m.errorMessage ?? 'model error'}`; dispatch.stop(); }
          if (!dry && m.stopReason !== 'aborted' && (!Number.isFinite(m.usage?.totalTokens) || m.usage.totalTokens === 0)) { failure = 'Missing provider usage'; dispatch.stop(); }
        });
      } }],
    });
    await loader.reload();
    const manager = dry ? SessionManager.inMemory(destination.cwd) : SessionManager.open(destination.sessionFile);
    const { session } = await createAgentSession({ cwd: destination.cwd, agentDir: destination.agentDir, model, modelRuntime: runtime, thinkingLevel: 'off', noTools: 'builtin', resourceLoader: loader, sessionManager: manager, settingsManager: SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } }) });
    let draft = '';
    await session.bindExtensions({ mode: 'tui', uiContext: { ...session.extensionRunner.getUIContext(), getEditorText: () => draft, notify: () => undefined, setStatus: () => undefined } });
    client.on('message', (from, message) => { try { if (!allowed.some((d: any) => d.sessionId === from.id)) throw new Error('Wrong recipient/contact'); adapter.receive(from.id, JSON.parse(message.content.text)); record({ received: message.id, by: destination.name }); } catch (error) { failure = String(error); } });
    await client.connect({ name: `gate-c-${destination.name}`, cwd: destination.cwd, model: model.id, pid: process.pid, startedAt: Date.now(), lastActivity: Date.now() }, destination.sessionId);
    workers.push({ ...destination, session, adapter, client, faux, draft: (text: string) => { draft = text; } });
  }
  const [coordinator, a, b, c] = workers;
  const timer = setInterval(() => { if (!failure) for (const w of workers) w.adapter.tick(); }, 50); timer.unref();
  try {
    if (!continuation) {
    dispatch.trial(1);
    script(coordinator, [fauxAssistantMessage('Findings received; no acknowledgement needed.')]);
    a.adapter.pause(true);
    const request = await coordinator.adapter.runtime.send({ to: { id: a.sessionId }, subject: 'Delayed reply', text: 'Read evidence.txt, then detail.txt on a separate tool turn. Then reply using this return handle with one concrete finding. Do not acknowledge separately. Stop after sending.' });
    await wait(() => a.adapter.intake.queued().length === 1, 'request buffered');
    if (dry) {
      script(a, [tool('fixture_read', { file: 'evidence.txt' }, 'read1'), tool('fixture_read', { file: 'detail.txt' }, 'read2'), fauxAssistantMessage('dry tools completed')]);
    }
    a.adapter.pause(false);
    await idle();
    if (dry) {
      // The dry test separately proved return-handle use; runner smoke injects no fake success receipt.
      results.push({ trial: 1, status: 'dry-plumbing-only', request: request.id, toolResults: a.session.messages.filter((m: any) => m.role === 'toolResult').length });
    } else {
      const replies = a.adapter.runtime.outbox().filter((m: any) => m.replyTo === request.id);
      if (replies.length !== 1 || !coordinator.adapter.runtime.inspect(replies[0].id)) throw new Error('Delayed reply did not link without rescue');
      const reads = a.session.messages.filter((m: any) => m.role === 'toolResult' && m.toolName === 'fixture_read');
      if (reads.length < 2) throw new Error('Delayed reply skipped required tools');
      results.push({ trial: 1, status: 'pass', request: request.id, response: replies[0].id, reads: reads.length });
    }
    }
    if (dry) { record({ smoke: results, note: 'No network or model judgment; trials 2/3 require live runner continuation' }); }
    else {
      dispatch.trial(2); holdEntered = false;
      if (!trial3Only) {
      const heldRun = coordinator.session.prompt('Call fixture_hold once to wait for the first findings. When released, call fixture_hold a second time on the next tool turn to wait for the later finding. After the second release, combine all findings into a concise result. Do not acknowledge peers.');
      void heldRun.catch(error => { failure = String(error); dispatch.stop(); });
      await wait(() => holdEntered, 'coordinator tool hold');
      const before = coordinator.adapter.intake.posted.length;
      c.adapter.pause(true);
      const requests = [];
      for (const w of [a, b, c]) requests.push(await coordinator.adapter.runtime.send({ to: { id: w.sessionId }, subject: `Concurrent ${w.name}`, text: `Return exactly one finding in reply to this request: ${w.name} confirms native IDs persist while volatile linkage can be lost. No file reads needed for this supplied synthetic fact; stop after sending.` }));
      await wait(() => coordinator.adapter.intake.queued().length === 2 && [a,b].every(w => w.session.isIdle), 'first two handbacks');
      holdEntered = false; releaseHold!();
      await wait(() => holdEntered, 'second coordinator boundary');
      c.adapter.pause(false);
      await wait(() => coordinator.adapter.intake.queued().length === 1 && c.session.isIdle, 'later handback');
      releaseHold!(); await heldRun; await idle();
      const admitted = coordinator.adapter.intake.posted.slice(before);
      if (admitted.length !== 2 || admitted[0].length !== 2 || admitted[1].length !== 1) throw new Error('Snapshot/later handback batching mismatch');
      results.push({ trial: 2, status: 'pass', batches: admitted, laterArrival: 'preserved in second batch' });
      }
      dispatch.trial(3); holdEntered = false;
      if (steerOnly) {
        const before = coordinator.adapter.intake.posted.length;
        const run = coordinator.session.prompt('Call fixture_hold once. After released follow the next human instruction. Do not send peer messages.');
        void run.catch(error => { failure = String(error); dispatch.stop(); });
        await wait(() => holdEntered, 'human steer boundary');
        await a.adapter.runtime.send({ to: { id: coordinator.sessionId }, subject: 'Steer ordering', text: 'Peer finding: volatile queues reset. Do not reply.' });
        await wait(() => coordinator.adapter.intake.queued().length === 1, 'peer waits during tool');
        await coordinator.session.prompt('Human directive: include HUMAN-FIRST-CONFIRMED in your next response. Do not send messages.', { streamingBehavior: 'steer' });
        releaseHold!(); await run; await idle();
        const messages = coordinator.session.messages;
        const marker = messages.findLastIndex((m: any) => m.role === 'user' && JSON.stringify(m.content).includes('Human directive:'));
        const peer = messages.findLastIndex((m: any) => m.role === 'custom' && JSON.stringify(m.content).includes('Steer ordering'));
        if (marker < 0 || peer <= marker || coordinator.adapter.intake.posted.length !== before + 1) throw new Error('Live human steering order failed');
        results.push({ trial: 3, status: 'pass-scripted-steering', humanEntryIndex: marker, peerEntryIndex: peer });
      } else {
      const stopRun = coordinator.session.prompt('Call fixture_hold once. Do not send messages.');
      void stopRun.catch(error => { failure = String(error); dispatch.stop(); });
      await wait(() => holdEntered, 'stop hold');
      operatorStopping = true;
      await coordinator.session.abort(); await stopRun;
      operatorStopping = false;
      const beforeStop = coordinator.adapter.intake.posted.length;
      coordinator.adapter.pause(true);
      await a.adapter.runtime.send({ to: { id: coordinator.sessionId }, subject: 'After Stop', text: 'Operator-seeded approved peer message. Summarize this in one sentence, no reply.' });
      await wait(() => coordinator.adapter.intake.queued().length === 1, 'paused receipt');
      await new Promise(r => setTimeout(r, 150));
      if (coordinator.adapter.intake.posted.length !== beforeStop || !coordinator.session.isIdle) throw new Error('Pause admitted/woke peer');
      coordinator.draft('Unsent human draft'); coordinator.adapter.pause(false); coordinator.adapter.tick();
      if (coordinator.adapter.intake.posted.length !== beforeStop) throw new Error('Draft priority failed');
      coordinator.draft('');
      await idle();
      if (coordinator.adapter.intake.posted.length !== beforeStop + 1) throw new Error('Resume did not admit later peer');
      results.push({ trial: 3, status: 'partial', stopPauseDraft: 'pass', humanSteer: 'separate steering continuation', nativeUI: 'SDK TUI hooks only; actual interactive human/overlay observation not performed' });
      }
    }
  } finally { clearInterval(timer); }
} catch (error) { failure = String(error); record({ failure }); }
finally {
  clearTimeout(deadline); releaseHold?.(); dispatch.stop();
  process.off('unhandledRejection', unhandled);
  for (const w of workers) { w.adapter.pause(true); await w.session.abort().catch(() => undefined); await w.session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' }); w.session.dispose(); await w.client.disconnect().catch(() => undefined); }
  if (broker && broker.exitCode === null && broker.signalCode === null) { const ended = once(broker, 'exit'); broker.kill('SIGTERM'); await ended; }
  const summary = { dry, results, failure, limits: dispatch.status(), uiLimit: 'No actual human interactive UI validation' };
  writeFileSync(path.join(root, dry ? 'dry-summary.json' : steerOnly ? 'steer-summary.json' : trial3Only ? 'trial3-summary.json' : continuation ? 'continuation-summary.json' : 'live-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}
if (failure) process.exitCode = 1;
