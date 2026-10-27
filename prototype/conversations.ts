import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export type Endpoint = { id: string; epoch: string };
export type Envelope = {
  id: string; exchange: string; subject: string; text: string;
  replyTo: string | null; corrects: string | null;
};
export type Record = Envelope & { from: Endpoint; to: Endpoint; state: 'accepted' | 'rejected' | 'unknown' };
export type Transport = (to: Endpoint, envelope: Envelope) => Promise<'accepted' | 'rejected' | 'unknown'>;
const same = (a: Endpoint, b: Endpoint) => a.id === b.id && a.epoch === b.epoch;

/** Volatile spike model, not an agent-facing authorization API. */
export function conversations(self: Endpoint, transport: Transport) {
  const approvals: Endpoint[] = [];
  const records = new Map<string, Record>();
  const returns = new Map<string, Record>();
  const inbox: Record[] = [];
  const outbox: Record[] = [];
  const approved = (peer: Endpoint) => approvals.some(p => same(p, peer));
  function rememberReturn(record: Record) {
    const handle = randomUUID();
    returns.set(handle, record);
    return handle;
  }
  return {
    // Only a trusted human/owner integration receives this function. Never registered as a tool.
    approveFromOwner(peer: Endpoint) { if (!approved(peer)) approvals.push({ ...peer }); },
    known: () => approvals.map(p => ({ ...p })),
    async send(input: { to?: Endpoint; respondTo?: string; subject?: string; text: string; corrects?: string }) {
      if (Boolean(input.to) === Boolean(input.respondTo) || !input.text.trim()) throw new Error('INVALID_INPUT');
      const source = input.respondTo ? returns.get(input.respondTo) : undefined;
      if (input.respondTo && !source) throw new Error('CONTEXT_LOST');
      const peer = source?.from ?? input.to!;
      if (!approved(peer)) throw new Error('CONTACT_NOT_APPROVED');
      if (!source && !input.subject?.trim()) throw new Error('INVALID_INPUT');
      const correction = input.corrects ? records.get(input.corrects) : undefined;
      if (input.corrects && (!correction || !same(correction.from, self) || !same(correction.to, peer))) throw new Error('INVALID_CORRECTION');
      const record: Record = { id: randomUUID(), exchange: source?.exchange ?? randomUUID(),
        subject: source?.subject ?? input.subject!, text: input.text, replyTo: source?.id ?? null,
        corrects: input.corrects ?? null, from: { ...self }, to: { ...peer }, state: 'unknown' };
      records.set(record.id, record); outbox.push(record);
      try { record.state = await transport(peer, record); } catch { record.state = 'unknown'; }
      // Never auto-retry or replace a send whose outcome is unknown.
      return structuredClone(record);
    },
    receive(from: Endpoint, to: Endpoint, envelope: Envelope) {
      if (!same(to, self)) throw new Error('STALE_HANDLE');
      if (!approved(from)) throw new Error('CONTACT_NOT_APPROVED');
      const previous = records.get(envelope.id);
      if (previous) {
        const duplicate = { ...envelope, from, to, state: previous.state };
        if (!isDeepStrictEqual(previous, duplicate)) throw new Error('ID_CONFLICT');
        return null;
      }
      if (envelope.replyTo) {
        const source = records.get(envelope.replyTo);
        if (!source || !same(source.from, self) || !same(source.to, from) || source.exchange !== envelope.exchange) throw new Error('INVALID_LINK');
      }
      if (envelope.corrects) {
        const source = records.get(envelope.corrects);
        if (!source || !same(source.from, from) || !same(source.to, self)) throw new Error('INVALID_CORRECTION');
      }
      const record: Record = { ...structuredClone(envelope), from: { ...from }, to: { ...to }, state: 'accepted' };
      records.set(record.id, record); inbox.push(record);
      return rememberReturn(record);
    },
    intake(count: number) { return structuredClone(inbox.splice(0, count)); },
    inspect: (id: string) => structuredClone(records.get(id) ?? null),
    outbox: () => structuredClone(outbox),
    queue: () => structuredClone(inbox),
  };
}
