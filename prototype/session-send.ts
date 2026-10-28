import type { Envelope } from './conversations.ts';

export type Connection = { id: string; epoch: string };
export type Attempt = { outcome: 'accepted' | 'rejected' | 'unknown'; code?: string };

/** Native session ID is public; at most one refresh after definite stale-connection rejection. */
export async function sendToSession(
  id: string, envelope: Envelope,
  approved: (id: string) => boolean,
  resolve: (id: string) => Promise<Connection | null>,
  send: (connection: Connection, envelope: Envelope) => Promise<Attempt>,
): Promise<Attempt> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!approved(id)) return { outcome: 'rejected', code: 'CONTACT_NOT_APPROVED' };
    const connection = await resolve(id);
    if (!connection || connection.id !== id) return { outcome: 'rejected', code: 'TARGET_UNAVAILABLE' };
    if (!approved(id)) return { outcome: 'rejected', code: 'CONTACT_NOT_APPROVED' };
    let result: Attempt;
    try { result = await send(connection, envelope); }
    catch { return { outcome: 'unknown', code: 'OUTCOME_UNKNOWN' }; }
    if (result.outcome !== 'rejected' || result.code !== 'E_TARGET_REBOUND' || attempt === 1) return result;
  }
  throw new Error('Unreachable');
}
