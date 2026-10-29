import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const waitFor = async (predicate: () => boolean, timeout = 10_000) => {
  const until = Date.now() + timeout;
  while (!predicate()) { if (Date.now() > until) throw new Error('Subprocess fixture timed out'); await new Promise(r => setTimeout(r, 10)); }
};

test('broker starter exits naturally after shutdown while another client keeps the shared broker alive', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pc-starter-exit-'));
  process.env.PI_CODING_AGENT_DIR = root;
  const extension = process.env.PI_COMMS_TEST_EXTENSION ?? fileURLToPath(new URL('../dist/extension.js', import.meta.url));
  const starterFile = join(root, 'starter.mjs');
  writeFileSync(starterFile, `
import { fauxProvider } from ${JSON.stringify(import.meta.resolve('@earendil-works/pi-ai'))};
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from ${JSON.stringify(import.meta.resolve('@earendil-works/pi-coding-agent'))};
const root = process.env.PI_CODING_AGENT_DIR;
const faux = fauxProvider({ provider: 'starter-shutdown-fixture' });
const models = await ModelRuntime.create({ authPath: root + '/auth.json', modelsPath: null, refreshOnCreate: false });
models.registerNativeProvider(faux.provider);
const loader = new DefaultResourceLoader({ cwd: root, agentDir: root, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, additionalExtensionPaths: [${JSON.stringify(extension)}] });
await loader.reload();
const { session } = await createAgentSession({ cwd: root, agentDir: root, model: faux.getModel(), modelRuntime: models, resourceLoader: loader, sessionManager: SessionManager.create(root, root + '/sessions'), noTools: 'builtin', settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }) });
await session.bindExtensions({ mode: 'print' });
console.log('READY ' + session.sessionId);
process.stdin.once('data', async () => {
  process.stdin.destroy();
  await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
  session.dispose();
  console.log('DISCONNECTED');
});
`);
  const child = spawn(process.execPath, [starterFile], { env: { ...process.env, PI_CODING_AGENT_DIR: root, PI_OFFLINE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', exit: { code: number | null; signal: string | null } | undefined;
  child.stdout.on('data', chunk => { stdout += chunk.toString(); }); child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  child.on('exit', (code, signal) => { exit = { code, signal }; });
  const { IntercomClient } = await import('../src/transport/broker/client.ts');
  const keeper = new IntercomClient();
  let diagnostic: ReturnType<typeof spawn> | undefined;
  let diagnosticExited = false;
  try {
    await waitFor(() => stdout.includes('READY ') || !!exit);
    assert.ok(!exit, `starter exited before ready: ${stderr}`);
    const starterId = stdout.match(/READY ([0-9a-f-]{36})/)![1];
    const brokerPid = Number(readFileSync(join(root, 'comms/broker.pid'), 'utf8'));
    await keeper.connect({ name: 'surviving peer', cwd: root, model: 'fixture', pid: process.pid, startedAt: Date.now(), lastActivity: Date.now() }, randomUUID());
    assert.ok((await keeper.listSessions()).some(p => p.id === starterId));
    child.stdin.end('quit\n');
    await waitFor(() => stdout.includes('DISCONNECTED'));
    try { await waitFor(() => !!exit, 3000); }
    catch { assert.fail(`starter remained alive after extension shutdown while another peer stayed connected; stderr: ${stderr}`); }
    assert.deepEqual(exit, { code: 0, signal: null });
    process.kill(brokerPid, 0);
    assert.equal(keeper.isConnected(), true);
    const peers = await keeper.listSessions();
    assert.ok(peers.some(p => p.id === keeper.sessionId));
    assert.ok(!peers.some(p => p.id === starterId));
    // Releasing the stderr handle must not discard startup failure diagnostics.
    const failingBroker = join(root, 'failing-broker.mjs');
    writeFileSync(failingBroker, `console.error('EXPECTED_STARTUP_DIAGNOSTIC'); process.exitCode = 17;`);
    const script = `import { spawnBrokerIfNeeded } from ${JSON.stringify(new URL('../src/transport/broker/spawn.ts', import.meta.url).href)};\ntry { await spawnBrokerIfNeeded(new URL(${JSON.stringify(pathToFileURL(failingBroker).href)})); process.exitCode = 1; } catch (error) { console.log(error.message); }`;
    diagnostic = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { env: { ...process.env, PI_CODING_AGENT_DIR: join(root, 'failed-startup'), PI_OFFLINE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let diagnosticOutput = '', diagnosticErrors = '', diagnosticCode: number | null = null;
    diagnostic.stdout!.on('data', chunk => { diagnosticOutput += chunk.toString(); });
    diagnostic.stderr!.on('data', chunk => { diagnosticErrors += chunk.toString(); });
    diagnostic.on('exit', code => { diagnosticCode = code; diagnosticExited = true; });
    await waitFor(() => diagnosticExited);
    assert.equal(diagnosticCode, 0, diagnosticErrors);
    assert.match(diagnosticOutput, /EXPECTED_STARTUP_DIAGNOSTIC/);
    assert.match(diagnosticOutput, /exited before startup/);
    assert.ok((await keeper.listSessions()).some(p => p.id === keeper.sessionId));
    // Broker termination is cleanup only, never the reason the starter exits.
  } finally {
    if (!exit) child.kill('SIGKILL');
    if (diagnostic && !diagnosticExited) diagnostic.kill('SIGKILL');
    await keeper.disconnect();
    try { process.kill(Number(readFileSync(join(root, 'comms/broker.pid'), 'utf8')), 'SIGTERM'); } catch {}
    await new Promise(r => setTimeout(r, 100)); rmSync(root, { recursive: true, force: true });
  }
});
