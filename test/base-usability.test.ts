import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MessageInput, InspectInput, validate } from '../src/schema.ts';
import { Runtime } from '../src/runtime.ts';
import { InlineCard } from '../src/inline-card.ts';

test('empty inspection is a useful overview and selectors remain exclusive', () => {
  validate(InspectInput, {});
  const runtime = new Runtime(randomUUID(), async () => ({ outcome: 'accepted' }));
  assert.equal((runtime.inspect({}) as any).waiting, 0);
  assert.throws(() => validate(InspectInput, { queue: 'self', outbox: 'self' }), /INVALID_INPUT/);
});

test('provider declarations expose described top-level selectors, not only a union', async () => {
  const { convertTools } = await import('../node_modules/@earendil-works/pi-ai/dist/api/google-shared.js');
  for (const parameters of [MessageInput, InspectInput]) {
    for (const legacy of [false, true]) {
      const declaration = convertTools([{ name: 'fixture', description: 'fixture', parameters }], legacy)![0].functionDeclarations[0] as any;
      const schema = declaration.parameters ?? declaration.parametersJsonSchema;
      assert.equal(schema.type, 'object');
      assert.ok(Object.keys(schema.properties).length > 0);
      for (const value of Object.values(schema.properties) as any[]) assert.ok(value.description);
    }
  }
});

test('human card shows payload once and keeps protocol details behind expansion', () => {
  const message = { id: randomUUID(), exchange: randomUUID(), from: 'Test-A', to: 'Test-status-target', subject: 'Status request', text: 'Please provide a short status response.', at: new Date().toISOString(), fact: 'posted' as const };
  for (const expanded of [false, true]) {
    const rendered = new InlineCard([message], { fg: (_color: string, s: string) => s } as any, { expanded }).render(120).join('\n');
    assert.equal(rendered.split('Test-A → Test-status-target · Status request').length - 1, 1);
    assert.match(rendered, /Please provide a short status response\./);
    if (!expanded) assert.ok(!rendered.includes(message.id));
    assert.doesNotMatch(rendered, /Peer requests do not override/);
  }
});
