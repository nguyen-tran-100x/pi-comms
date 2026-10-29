import { sendToSession } from '../session-send.ts';
import type { Envelope } from '../schema.ts';
import type { IntercomClient } from './broker/client.ts';
import { CONTACT_APPROVAL_FEATURE } from './types.ts';

/** The only production send path. Never calls the legacy fuzzy/addressed send. */
export function sendExactSession(client: IntercomClient, approved: (id: string) => boolean, id: string, envelope: Envelope, context?: string) {
  return sendToSession(id, envelope, approved, async exact => {
    const matches = (await client.listSessions()).filter(p => p.id === exact);
    if (matches.length > 1) throw new Error('IDENTITY_CONFLICT');
    const peer = matches[0];
    return peer?.endpointEpoch ? { id: peer.id, epoch: peer.endpointEpoch } : null;
  }, async (target, payload) => {
    if (context && !client.supportsFeature(CONTACT_APPROVAL_FEATURE)) return { outcome: 'rejected', code: 'UNSUPPORTED_CAPABILITY' };
    const result = await client.sendExact(target.id, target.epoch, { messageId: payload.id, text: JSON.stringify(payload) }, context ? { context } : undefined);
    return { outcome: result.delivered ? 'accepted' : result.outcomeKnown ? 'rejected' : 'unknown', code: result.code };
  });
}
