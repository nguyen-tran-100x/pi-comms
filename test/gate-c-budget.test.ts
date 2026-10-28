import test from 'node:test';
import assert from 'node:assert/strict';
import { gateCBudget, gateCLimits } from '../prototype/gate-c-budget.ts';

test('Gate C pre-request reservation bounds calls, payload and worst-case spend without refunds', () => {
  const budget = gateCBudget();
  assert.throws(() => budget.reserve({ text: 'x'.repeat(32768) }), /PAYLOAD_LIMIT/);
  assert.equal(budget.status().calls, 0);
  const payload = { text: 'x'.repeat(32700) };
  for (let i = 0; i < 24; i++) budget.reserve(payload);
  assert.equal(budget.status().calls, 24);
  assert.ok(budget.status().reservedUsd < gateCLimits.capUsd);
  assert.throws(() => budget.reserve({}), /TURN_LIMIT/);
});
