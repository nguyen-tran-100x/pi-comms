export const gateCLimits = Object.freeze({ calls: 24, maxOutputTokens: 2048, maxPayloadBytes: 32768, overheadTokens: 8192, capUsd: 2, inputUsdPerMillion: 0.75, outputUsdPerMillion: 4.5 });

/** Reserve maximum cost before each request; unknown/aborted requests keep their reservation. */
export function gateCBudget(enforceDollarCap = true, priorCalls = 0) {
  let calls = priorCalls;
  let reserved = 0;
  return {
    reserve(payload: unknown) {
      const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
      if (bytes > gateCLimits.maxPayloadBytes) throw new Error('PAYLOAD_LIMIT');
      if (calls >= gateCLimits.calls) throw new Error('TURN_LIMIT');
      // UTF-8 bytes conservatively bound text BPE tokens; reserve extra for provider framing.
      const usd = ((bytes + gateCLimits.overheadTokens) * gateCLimits.inputUsdPerMillion + gateCLimits.maxOutputTokens * gateCLimits.outputUsdPerMillion) / 1_000_000;
      if (enforceDollarCap && reserved + usd > gateCLimits.capUsd) throw new Error('SPEND_LIMIT');
      calls++; reserved += usd;
      return { calls, reservedUsd: enforceDollarCap ? reserved : null, maxOutputTokens: gateCLimits.maxOutputTokens };
    },
    status: () => ({ calls, reservedUsd: enforceDollarCap ? reserved : null }),
  };
}
