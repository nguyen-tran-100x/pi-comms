import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { gateCDispatch, gateCModel } from '../prototype/gate-c-dispatch.ts';
import { bindGateCProvider } from '../prototype/gate-c-provider.ts';

test('real provider serialization is intercepted before network with approved model and bounds', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'pcc-provider-'));
  try {
    const runtime = await ModelRuntime.create({ authPath: path.join(root, 'auth.json'), modelsPath: null, refreshOnCreate: false });
    let captured: any;
    const dispatch = gateCDispatch(async (input, init) => { captured = JSON.parse(typeof init?.body === 'string' ? init.body : await (input as Request).clone().text()); return new Response('fixture denial; no network', { status: 400 }); });
    dispatch.trial(1);
    const model = await bindGateCProvider(runtime, 'sk-fixture-not-a-credential', dispatch);
    assert.ok(await runtime.getAuth(model), 'native prompt preflight sees explicit runtime-only credential');
    const message = await runtime.streamSimple(model, { messages: [{ role: 'user', content: 'synthetic preflight', timestamp: Date.now() }] } as any).result();
    assert.equal(message.stopReason, 'error');
    assert.ok(captured, `request reached the interception point: ${message.errorMessage}`);
    assert.equal(captured.model, gateCModel);
    assert.equal(captured.max_output_tokens, 2048);
    assert.equal(captured.reasoning.effort, 'none');
    assert.equal(dispatch.status().calls, 1);
    assert.equal(dispatch.status().stopped, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
