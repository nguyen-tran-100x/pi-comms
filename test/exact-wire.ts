import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { getBrokerConnectTarget } from '../.scratch/upstream/broker/paths.ts';
import { createMessageReader, writeMessage } from '../.scratch/upstream/broker/framing.ts';
import type { Endpoint, Envelope } from '../prototype/conversations.ts';

/** Fixture-only protocol probe: freeze id+epoch on wire, no name lookup or rebound retry. */
export async function exactWire(id: string) {
  const target = getBrokerConnectTarget();
  const socket = typeof target === 'string' ? net.connect(target) : net.connect({ host: target.host, port: target.port });
  const pending = new Map<string, (message: any) => void>();
  let registered!: () => void;
  const connected = new Promise<void>(resolve => { registered = resolve; });
  socket.on('error', () => undefined);
  socket.on('data', createMessageReader((message: any) => {
    if (message.type === 'registered') registered();
    const resolve = pending.get(message.messageId);
    if (resolve) { pending.delete(message.messageId); resolve(message); }
  }, error => socket.destroy(error)));
  writeMessage(socket, { type: 'register', sessionId: id, session: { name: id, cwd: process.cwd(), model: 'fixture', pid: process.pid, startedAt: Date.now(), lastActivity: Date.now() } });
  await connected;
  return {
    async attempt(to: Endpoint, envelope: Envelope): Promise<import('../prototype/session-send.ts').Attempt> {
      return new Promise(resolve => {
        const timer = setTimeout(() => { pending.delete(envelope.id); resolve({ outcome: 'unknown' }); }, 2000);
        pending.set(envelope.id, response => { clearTimeout(timer); resolve({ outcome: response.type === 'delivered' ? 'accepted' : response.outcomeKnown ? 'rejected' : 'unknown', code: response.code }); });
        writeMessage(socket, { type: 'send', to: to.id, targetId: to.id, targetEpoch: to.epoch,
          message: { id: envelope.id ?? randomUUID(), timestamp: Date.now(), content: { text: JSON.stringify(envelope) } } });
      });
    },
    async send(to: Endpoint, envelope: Envelope) { return (await this.attempt(to, envelope)).outcome; },
    close: () => socket.destroy(),
  };
}
