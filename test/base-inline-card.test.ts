import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleWidth } from '@earendil-works/pi-tui';
import { InlineCard, registerInlineCards, type CardMessage } from '../src/inline-card.ts';
const theme = { fg: (_color: string, text: string) => text } as any;
const messages: CardMessage[] = ['A', 'B', 'C'].map(name => ({ id: `technical-id-${name}`, from: `Reviewer ${name} 日本語`, to: 'Coordinator', subject: 'Storage review', text: `Complete finding ${name}: ` + 'use memory, preserve replies. '.repeat(5), exchange: `exchange-${name}`, at: '2026-10-28T08:00:00Z', fact: 'posted' }));

test('inline cards adapt collapse, full expansion, narrow widths and click behavior', () => {
  for (const width of [0, 1, 2, 12, 30, 80]) {
    const state = { expanded: false }; const card = new InlineCard(messages, theme, state);
    assert.ok(card.render(width).every(line => visibleWidth(line) <= width));
    if (width >= 30) assert.doesNotMatch(card.render(width).join('\n'), /technical-id/);
    assert.equal(card.handleMouse({ type: 'click', button: 'left', clickCount: 1 } as any)?.handled, true);
    assert.ok(card.render(width).every(line => visibleWidth(line) <= width));
    if (width === 80) {
      const full = card.render(width).join('\n');
      assert.match(full, /technical-id-A/); assert.match(full, /technical-id-C/); assert.match(full, /Complete finding B/);
    }
  }
});

test('correction cards identify the relationship collapsed and the exact source expanded', () => {
  const correction = { ...messages[0], corrects: 'earlier-message-id' };
  const collapsed = new InlineCard([correction], theme, { expanded: false }).render(80).join('\n');
  assert.match(collapsed, /Correction/); assert.doesNotMatch(collapsed, /earlier-message-id/);
  const expanded = new InlineCard([correction], theme, { expanded: true }).render(160).join('\n');
  assert.match(expanded, /corrects earlier-message-id/);
});

test('native renderer registration honors global expanded state and missing details', () => {
  let renderer: any;
  registerInlineCards({ registerMessageRenderer: (name: string, fn: any) => { assert.equal(name, 'comms_batch'); renderer = fn; } } as any);
  assert.equal(renderer({}, { expanded: false }, theme), undefined);
  const message = { details: { messages } };
  assert.doesNotMatch(renderer(message, { expanded: false }, theme).render(100).join('\n'), /technical-id/);
  assert.match(renderer(message, { expanded: true }, theme).render(100).join('\n'), /technical-id-A/);
});
