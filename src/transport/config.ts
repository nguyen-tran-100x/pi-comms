// The retained broker supports legacy ask envelopes; pi-comms never uses them.
export const getAskTimeoutMs = () => 300_000;
export const getIntercomScopeId = () => undefined;
