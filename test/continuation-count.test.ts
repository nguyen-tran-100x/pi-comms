import test from 'node:test';
import assert from 'node:assert/strict';
import { gateCDispatch, gateCModel, gateCBaseUrl } from '../prototype/gate-c-dispatch.ts';

test('continuation preserves overall request bound and journals before actual network dispatch', async () => {
  const events: string[] = [];
  const dispatch = gateCDispatch(async () => { events.push('network'); return new Response('{}'); }, Date.now, 23, entry => { events.push(`journal-${(entry as any).attempt}`); });
  dispatch.trial(1);
  const init = { method: 'POST', body: JSON.stringify({ model: gateCModel, max_output_tokens: 2048, reasoning: { effort: 'none' }, store: false, input: [] }) };
  await dispatch.fetch(`${gateCBaseUrl}/responses`, init);
  assert.deepEqual(events, ['journal-24', 'network']);
  await assert.rejects(dispatch.fetch(`${gateCBaseUrl}/responses`, init), /TURN_LIMIT/);
  assert.equal(dispatch.status().calls, 24); assert.equal(events.length, 2);
});
