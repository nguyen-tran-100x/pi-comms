import { gateCBudget, gateCLimits } from './gate-c-budget.ts';

export const gateCModel = 'gpt-5.6-luna';
export const gateCBaseUrl = 'https://ai-router.davidustranus.space/v1';

/** Shared across all sessions. Every actual HTTP attempt reserves cost; no retry exemption. */
export function gateCDispatch(network: typeof fetch, now = Date.now, priorCalls = 0, journal: (entry: unknown) => void = () => undefined) {
  const budget = gateCBudget(false, priorCalls); // Owner removed dollar cap; router prices are unknown.
  const started = now();
  let trial = 0;
  let trialCalls = 0;
  let stopped = false;
  const allowances = [6, 10, 8];
  return {
    trial(index: number) {
      if (index !== trial + 1 || index > 3 || stopped) throw new Error('INVALID_TRIAL');
      trial = index; trialCalls = 0;
    },
    stop() { stopped = true; },
    status: () => ({ ...budget.status(), trial, trialCalls, stopped }),
    fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (stopped || now() - started >= 15 * 60_000) throw new Error('RUN_STOPPED');
      try {
        if (!trial || trialCalls >= allowances[trial - 1]) throw new Error('TRIAL_TURN_LIMIT');
        const request = input instanceof Request ? input : undefined;
        const url = request?.url ?? String(input);
        const method = init?.method ?? request?.method;
        const body = init?.body ?? (request ? await request.clone().text() : undefined);
        if (url !== `${gateCBaseUrl}/responses` || method !== 'POST' || typeof body !== 'string') throw new Error('UNAPPROVED_ENDPOINT');
        const payload = JSON.parse(body);
        if (payload.model !== gateCModel || payload.max_output_tokens !== gateCLimits.maxOutputTokens || payload.reasoning?.effort !== 'none' || payload.store !== false || payload.previous_response_id || payload.conversation || payload.background || payload.include?.length) throw new Error('UNAPPROVED_REQUEST');
        if (payload.tools?.some((tool: any) => tool.type !== 'function')) throw new Error('BILLABLE_HOSTED_TOOL');
        // Only text/function content is allowed. Fixture sources contain no media.
        for (const item of payload.input ?? []) {
          for (const block of Array.isArray(item.content) ? item.content : []) {
            if (block.type !== 'input_text' && block.type !== 'output_text') throw new Error('MEDIA_NOT_APPROVED');
          }
        }
        const reservation = budget.reserve(payload); trialCalls++;
        journal({ attempt: reservation.calls, trial, model: payload.model, payloadBytes: Buffer.byteLength(body), maxOutputTokens: payload.max_output_tokens });
        const sourceSignal = init?.signal ?? request?.signal;
        const signal = sourceSignal ? AbortSignal.any([sourceSignal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000);
        const response = await network(input, { ...init, signal, redirect: 'error' });
        if (!response.ok) stopped = true;
        return response;
      } catch (error) { stopped = true; throw error; }
    },
  };
}
