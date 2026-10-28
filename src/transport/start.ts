import { IntercomClient } from './broker/client.ts';
import { spawnBrokerIfNeeded } from './broker/spawn.ts';
import type { SessionRegistration } from './types.ts';

export async function connect(self: string, registration: SessionRegistration, client: IntercomClient, brokerURL: URL) {
  // Retain upstream health probe + exclusive spawn lock; never unlink a live broker's socket.
  await spawnBrokerIfNeeded(brokerURL);
  await client.connect(registration, self);
  return client;
}
