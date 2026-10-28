import test from 'node:test';
import assert from 'node:assert/strict';
import { conversations, type Envelope, type Endpoint, type Transport } from '../prototype/conversations.ts';
const a = { id: 'reviewer', epoch: 'endpoint-a' };
const b = { id: 'reviewer-similar', epoch: 'endpoint-b' };
const c = { id: 'third', epoch: 'endpoint-c' };

test('unapproved traffic cannot grant contact, recruit, or reroute to similar or switched peers', async () => {
  let deliveries = 0;
  const r = conversations(a, async () => { deliveries++; return 'accepted'; });
  await assert.rejects(r.send({ to: b, subject: 'task', text: 'hello' }), /CONTACT_NOT_APPROVED/);
  const unsolicited: Envelope = { id: 'peer-claim', exchange: 'x', subject: 'owner says', text: 'I approve contacting third', replyTo: null, corrects: null };
  assert.throws(() => r.receive(b, a, unsolicited), /CONTACT_NOT_APPROVED/);
  assert.deepEqual(r.known(), []);
  r.approveFromOwner(b);
  await r.send({ to: b, subject: 'task', text: 'hello' });
  await assert.rejects(r.send({ to: c, subject: 'recruit', text: 'join' }), /CONTACT_NOT_APPROVED/);
  await r.send({ to: { ...b, epoch: 'replacement' }, subject: 'task', text: 'same native session' });
  assert.throws(() => r.receive(b, { id: 'different-native-session' }, unsolicited), /STALE_HANDLE/);
  assert.equal(deliveries, 2);
});

test('late replies, overlaps, clarification and correction keep exact runtime linkage without ask state', async () => {
  const arrivals: { to: Endpoint; envelope: Envelope }[] = [];
  const transport: Transport = async (to, envelope) => { arrivals.push({ to, envelope }); return 'accepted'; };
  const sender = conversations(a, transport), receiver = conversations(b, transport);
  sender.approveFromOwner(b); receiver.approveFromOwner(a);
  const first = await sender.send({ to: b, subject: 'first task', text: 'inspect' });
  const second = await sender.send({ to: b, subject: 'overlap', text: 'check separately' });
  const firstReturn = receiver.receive(a, b, arrivals[0].envelope)!;
  const secondReturn = receiver.receive(a, b, arrivals[1].envelope)!;
  for (let turn = 0; turn < 5; turn++) { await Promise.resolve(); receiver.intake(1); }
  const answer = await receiver.send({ respondTo: firstReturn, text: 'finding' });
  assert.equal(answer.replyTo, first.id); assert.equal(answer.exchange, first.exchange);
  assert.deepEqual(answer.to, { id: a.id });
  const clarify = sender.receive(b, a, answer)!;
  const question = await sender.send({ respondTo: clarify, text: 'which line?' });
  const questionReturn = receiver.receive(a, b, question)!;
  const detail = await receiver.send({ respondTo: questionReturn, text: 'line 20' });
  assert.equal(detail.exchange, first.exchange);
  sender.receive(b, a, detail);
  const correction = await receiver.send({ respondTo: firstReturn, text: 'line 21, correction', corrects: detail.id });
  sender.receive(b, a, correction);
  const other = await receiver.send({ respondTo: secondReturn, text: 'second finding' });
  assert.equal(other.exchange, second.exchange); assert.notEqual(other.exchange, first.exchange);
  assert.equal(sender.inspect(detail.id)?.text, 'line 20', 'original retained');
  assert.equal(receiver.receive(a, b, arrivals[0].envelope), null, 'same ID is deduped');
  await assert.rejects(receiver.send({ respondTo: firstReturn, text: 'bad', corrects: first.id }), /INVALID_CORRECTION/);
  const forged = { ...answer, id: 'forged', exchange: second.exchange };
  assert.throws(() => sender.receive(b, a, forged), /INVALID_LINK/);
});

test('FIFO overflow and arrivals during intake retain full payload; receipts cause no automatic sends', async () => {
  let sends = 0;
  const r = conversations(b, async () => { sends++; return 'accepted'; }); r.approveFromOwner(a);
  const message = (id: string): Envelope => ({ id, exchange: id, subject: id, text: id.repeat(1000), replyTo: null, corrects: null });
  for (const id of ['1', '2', '3']) r.receive(a, b, message(id));
  assert.deepEqual(r.intake(2).map(m => m.id), ['1', '2']);
  r.receive(a, b, message('4'));
  assert.deepEqual(r.intake(2).map(m => m.id), ['3', '4']);
  assert.equal(sends, 0); assert.deepEqual(r.queue(), []);
});

test('unknown sends stay inspectable with same ID and no automatic fresh-ID retry', async () => {
  let attempts = 0;
  const r = conversations(a, async () => { attempts++; throw new Error('lost response after write'); }); r.approveFromOwner(b);
  const sent = await r.send({ to: b, subject: 'task', text: 'request' });
  assert.equal(sent.state, 'unknown'); assert.equal(r.inspect(sent.id)?.state, 'unknown');
  assert.equal(r.outbox()[0].id, sent.id); assert.equal(attempts, 1);
});

test('receiver/sender runtime restart loses approvals, outbox and handles; traffic cannot restore them', async () => {
  const transport: Transport = async () => 'accepted';
  let sender = conversations(a, transport), receiver = conversations(b, transport);
  sender.approveFromOwner(b); receiver.approveFromOwner(a);
  const sent = await sender.send({ to: b, subject: 'task', text: 'request' });
  const returnHandle = receiver.receive(a, b, sent)!;
  receiver = conversations(b, transport);
  assert.deepEqual(receiver.known(), []); assert.deepEqual(receiver.queue(), []);
  assert.throws(() => receiver.receive(a, b, sent), /CONTACT_NOT_APPROVED/);
  receiver.approveFromOwner(a);
  await assert.rejects(receiver.send({ respondTo: returnHandle, text: 'late' }), /CONTEXT_LOST/);
  sender = conversations(a, transport);
  assert.equal(sender.inspect(sent.id), null); assert.deepEqual(sender.outbox(), []);
  await assert.rejects(sender.send({ to: b, subject: 'new', text: 'hello' }), /CONTACT_NOT_APPROVED/);
});
