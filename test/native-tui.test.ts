import test from 'node:test';
import assert from 'node:assert/strict';
import { TuiMainScreen, Text } from '@earendil-works/pi-tui';
import { InlineCard } from '../prototype/inline-card.ts';

test('native TUI renders inline card, keeps overlay input ownership during background update', () => {
  let input!: (data: string) => void;
  const output: string[] = [];
  const terminal: any = { columns: 60, rows: 30, kittyProtocolActive: false, start: (fn: any) => { input = fn; }, stop() {}, write: (text: string) => output.push(text), moveBy() {}, hideCursor() {}, showCursor() {}, clearLine() {}, clearFromCursor() {}, clearScreen() {}, setTitle() {}, setProgress() {}, setProgramStatus() {} };
  const tui = new TuiMainScreen(terminal);
  const theme = { fg: (_color: string, text: string) => text } as any;
  const state = { expanded: false };
  const card = new InlineCard([{ id: 'message', from: 'Reviewer', to: 'Coordinator', subject: 'Native card smoke', text: 'Complete finding from saved transcript', exchange: 'exchange', at: '2026-10-28', fact: 'saved' }], theme, state);
  tui.addChild(card); tui.start();
  try {
    tui.renderNow(true);
    let received = '';
    const overlay = { render: () => ['Overlay owns input; background card may update.'], invalidate() {}, handleInput: (data: string) => { received += data; } };
    tui.showOverlay(overlay, { width: 55 }); assert.equal(tui.hasOverlay(), true);
    state.expanded = true; tui.requestRender(); tui.renderNow(true);
    input('x'); assert.equal(received, 'x', 'background renderer did not steal input focus');
    tui.hideOverlay(); assert.equal(tui.hasOverlay(), false); tui.renderNow(true);
    assert.match(output.join(''), /Reviewer/); assert.match(output.join(''), /Complete finding/);
  } finally { tui.stop(); }
});
