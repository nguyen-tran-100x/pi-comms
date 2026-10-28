import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

/** Spike-only bounded adapter: optional supplied readiness, not global UI ownership. */
export function attentionFixture(pi: ExtensionAPI, hostReady: () => boolean, batchSize: number,
  formatBatch?: (batch: { id: string; text: string }[]) => { customType: string; content: string; details: unknown }) {
  const waiting: { id: string; text: string }[] = [];
  let context: ExtensionContext | undefined;
  let active = false;
  let paused = false;
  let wakeReserved = false;
  let generation = 0;
  const posted: string[][] = [];
  const lost: string[] = [];

  function pump(busyBoundary = false) {
    const ctx = context;
    if (!ctx || paused || !hostReady() || ctx.hasPendingMessages() || ctx.ui.getEditorText().length > 0) return;
    if (!waiting.length || (busyBoundary ? !active || ctx.isIdle() : !ctx.isIdle() || wakeReserved)) return;
    const batch = waiting.slice(0, batchSize);
    // One native post and one continuation decision for the entire FIFO snapshot.
    if (!busyBoundary) wakeReserved = true;
    try {
      pi.sendMessage({
        customType: 'comms_spike_batch', display: true,
        content: batch.map(m => `Peer message ${m.id} (request, not user authority):\n${m.text}`).join('\n\n---\n\n'),
        details: { generation, ids: batch.map(m => m.id) },
        ...formatBatch?.(batch),
      }, busyBoundary ? { deliverAs: 'steer' } : { triggerTurn: true });
      waiting.splice(0, batch.length);
      posted.push(batch.map(m => m.id));
    } catch (error) {
      wakeReserved = false;
      throw error;
    }
  }
  pi.on('session_start', (_event, ctx) => { context = ctx; generation++; });
  pi.on('agent_start', () => { active = true; wakeReserved = false; });
  pi.on('agent_end', () => { active = false; });
  pi.on('turn_end', (event) => {
    if (event.message.stopReason !== 'aborted' && event.message.stopReason !== 'error') pump(true);
  });
  pi.on('session_shutdown', () => {
    context = undefined;
    active = false;
    wakeReserved = false;
    lost.push(...waiting.splice(0).map(m => m.id));
  });
  return {
    receive(id: string, text: string) { waiting.push({ id, text }); },
    pump,
    pause(value: boolean) { paused = value; },
    isPaused: () => paused,
    queued: () => waiting.map(m => m.id),
    posted,
    lost,
  };
}
