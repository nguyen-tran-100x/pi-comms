import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Runtime } from '../src/runtime.ts';

test('all agent inspection views withhold unapproved incoming payload and handles; human view retains evidence', () => {
  const self = randomUUID(), peer = randomUUID();
  const runtime = new Runtime(self, async () => ({ outcome: 'accepted' }));
  const envelope = { id: randomUUID(), exchange: randomUUID(), subject: 'PRIVATE_SUBJECT', text: 'PRIVATE_BODY', refs: [{ uri: 'file:///PRIVATE_URI', label: 'PRIVATE_LABEL' }], replyTo: null, corrects: null, createdAt: new Date().toISOString() };
  runtime.receive(peer, envelope);
  const handle = runtime.entry(envelope.id)!.returnHandle!;
  for (const input of [{ queue: 'self' as const }, { message: envelope.id }, { exchange: envelope.exchange }, {}, { peer }]) {
    const hidden = JSON.stringify(runtime.inspect(input));
    for (const secret of ['PRIVATE_', handle]) assert.ok(!hidden.includes(secret), `agent projection leaked ${secret}`);
    assert.match(hidden, /CONTACT_NOT_APPROVED/);
    const human = JSON.stringify(runtime.inspect(input, 'human'));
    assert.match(human, /PRIVATE_BODY/);
    if ('message' in input || 'exchange' in input || 'queue' in input) assert.ok(human.includes(handle));
  }
  runtime.approveFromOwner({ id: peer, name: 'Reviewer', context: 'review' });
  assert.match(JSON.stringify(runtime.inspect({ message: envelope.id })), /PRIVATE_BODY/);
  runtime.revokeFromOwner(peer);
  runtime.approveFromTransport({ id: peer, name: 'Reviewer', context: 'attempted resend' });
  assert.equal(runtime.isApproved(peer), false, 'transport cannot undo explicit receiver revocation');
  for (const input of [{ exchange: envelope.exchange }, {}, { peer }]) assert.doesNotMatch(JSON.stringify(runtime.inspect(input)), /PRIVATE_/);
});
