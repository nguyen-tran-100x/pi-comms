import test from 'node:test';
import assert from 'node:assert/strict';
import { gateCDispatch, gateCModel, gateCBaseUrl } from '../prototype/gate-c-dispatch.ts';
const body = { model: gateCModel, max_output_tokens: 2048, reasoning: { effort: 'none' }, store: false, input: [{ role: 'user', content: [{ type: 'input_text', text: 'synthetic test' }] }], tools: [{ type: 'function', name: 'fixture_read' }] };
const request = (payload = body) => ({ method: 'POST', body: JSON.stringify(payload) });

test('no-network dispatch reserves each attempt, enforces per-trial limits, endpoint and output', async () => {
  let requests = 0;
  const dispatch = gateCDispatch(async (_input, init) => { requests++; assert.equal(init?.redirect, 'error'); assert.ok(init?.signal); return new Response('{}'); });
  dispatch.trial(1);
  for (let i = 0; i < 6; i++) await dispatch.fetch(`${gateCBaseUrl}/responses`, request());
  assert.equal(dispatch.status().calls, 6);
  assert.equal(dispatch.status().reservedUsd, null, 'router prices unknown, no fabricated dollar estimate');
  await assert.rejects(dispatch.fetch(`${gateCBaseUrl}/responses`, request()), /TRIAL_TURN_LIMIT/);
  assert.equal(requests, 6); assert.equal(dispatch.status().stopped, true);
  for (const [url, payload] of [ ['https://example.org', body], [`${gateCBaseUrl}/responses`, { ...body, max_output_tokens: 4096 }], [`${gateCBaseUrl}/responses`, { ...body, tools: [{ type: 'web_search' }] }] ] as const) {
    const denied = gateCDispatch(async () => { throw new Error('network must not run'); }); denied.trial(1);
    await assert.rejects(denied.fetch(url, request(payload as any)), /UNAPPROVED|BILLABLE/);
    assert.equal(denied.status().calls, 0);
  }
});

test('unknown attempt is charged and stops rather than retrying; wall clock blocks launch', async () => {
  const dispatch = gateCDispatch(async () => { throw new Error('unknown network outcome'); }); dispatch.trial(1);
  await assert.rejects(dispatch.fetch(`${gateCBaseUrl}/responses`, request()), /unknown network/);
  assert.equal(dispatch.status().calls, 1);
  await assert.rejects(dispatch.fetch(`${gateCBaseUrl}/responses`, request()), /RUN_STOPPED/);
  let now = 0;
  const expired = gateCDispatch(async () => { throw new Error('must not run'); }, () => now); expired.trial(1); now = 900001;
  await assert.rejects(expired.fetch(`${gateCBaseUrl}/responses`, request()), /RUN_STOPPED/);
});
