import type { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { gateCDispatch, gateCModel, gateCBaseUrl } from './gate-c-dispatch.ts';
import { gateCLimits } from './gate-c-budget.ts';

/** Isolated runtime instance only; explicit key, no normal auth lookup or provider fallback. */
export async function bindGateCProvider(runtime: ModelRuntime, key: string, dispatch: ReturnType<typeof gateCDispatch>) {
  if (!key.startsWith('sk-')) throw new Error('DIRECT_OPENAI_API_KEY_REQUIRED');
  await runtime.setRuntimeApiKey('openai', key);
  const base = runtime.getModel('openai', 'gpt-5.4-mini');
  if (!base) throw new Error('MODEL_UNAVAILABLE');
  // Router pricing is unknown; zero catalog estimates prevent false OpenAI cost claims.
  const model = { ...base, id: gateCModel, baseUrl: gateCBaseUrl, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, compat: { ...base.compat, supportsMaxOutputTokens: true } };
  const stream = runtime.streamSimple.bind(runtime);
  runtime.streamSimple = (requested, context, options) => {
    if (requested.provider !== 'openai' || requested.id !== gateCModel) throw new Error('MODEL_NOT_APPROVED');
    return stream(model, context, { ...options, apiKey: key, fetch: dispatch.fetch,
      maxTokens: gateCLimits.maxOutputTokens, maxRetries: 0, timeoutMs: 60_000,
      reasoning: 'none', cacheRetention: 'none',
    });
  };
  return model;
}
