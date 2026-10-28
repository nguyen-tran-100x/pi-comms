import test from 'node:test';
import assert from 'node:assert/strict';
import { sendToSession } from '../prototype/session-send.ts';
import { conversations, type Envelope } from '../prototype/conversations.ts';
const envelope: Envelope = { id: 'same-operation', exchange: 'x', subject: 'task', text: 'hello', replyTo: null, corrects: null };

test('refreshes same native ID once after definite rejection, keeping message ID and approval', async () => {
  const resolutions: string[] = [], sends: any[] = [];
  const result = await sendToSession('native-S', envelope, id => id === 'native-S', async id => {
    resolutions.push(id); return { id, epoch: `connection-${resolutions.length}` };
  }, async (connection, message) => {
    sends.push({ connection, message });
    return sends.length === 1 ? { outcome: 'rejected', code: 'E_TARGET_REBOUND' } : { outcome: 'accepted' };
  });
  assert.equal(result.outcome, 'accepted'); assert.deepEqual(resolutions, ['native-S', 'native-S']);
  assert.deepEqual(sends.map(s => s.message.id), ['same-operation', 'same-operation']);
  assert.deepEqual(sends.map(s => s.connection.epoch), ['connection-1', 'connection-2']);
});

test('revoked approval, repeated churn, wrong-ID resolution and unknown outcomes never expand retry', async () => {
  for (const scenario of ['revoked', 'churn', 'wrong-id', 'unknown', 'throw'] as const) {
    let allowed = true, resolutions = 0, attempts = 0;
    const result = await sendToSession('native-S', envelope, () => allowed, async id => {
      resolutions++; return { id: scenario === 'wrong-id' ? 'same-named-other' : id, epoch: `${resolutions}` };
    }, async () => {
      attempts++;
      if (scenario === 'revoked') allowed = false;
      if (scenario === 'throw') throw new Error('response lost');
      return scenario === 'unknown' ? { outcome: 'unknown' } : { outcome: 'rejected', code: 'E_TARGET_REBOUND' };
    });
    assert.notEqual(result.outcome, 'accepted');
    assert.equal(attempts, scenario === 'churn' ? 2 : scenario === 'wrong-id' ? 0 : 1);
    assert.equal(resolutions, scenario === 'churn' ? 2 : 1);
  }
});

test('runtime return handle and retained approval follow native session identity across connection change', async () => {
  const owner = { id: 'owner' }, reviewer = { id: 'reviewer' };
  const a = conversations(owner, async () => 'accepted');
  const b = conversations(reviewer, async () => 'accepted');
  a.approveFromOwner({ ...reviewer, epoch: 'old' }); b.approveFromOwner(owner);
  const request = await a.send({ to: reviewer, subject: 'task', text: 'inspect' });
  const handle = b.receive(owner, reviewer, request)!;
  const answer = await b.send({ respondTo: handle, text: 'late finding' });
  assert.ok(a.receive({ ...reviewer, epoch: 'new' }, owner, answer));
  assert.equal(a.isApproved(reviewer.id), true); assert.deepEqual(a.known(), [reviewer]);
  a.revokeFromOwner(reviewer.id);
  await assert.rejects(a.send({ to: reviewer, subject: 'task', text: 'no longer approved' }), /CONTACT_NOT_APPROVED/);
});
