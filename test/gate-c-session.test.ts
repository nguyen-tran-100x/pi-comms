import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { gateCSession } from '../prototype/gate-c-session.ts';

test('small Gate C adapter exposes approved tools, links return handle and renders one native batch', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'pcc-adapter-'));
  try {
    writeFileSync(path.join(root, 'evidence.txt'), 'synthetic source');
    const hooks = new Map<string, Function[]>(), tools = new Map<string, any>(), posts: any[] = [], commands = new Map<string, any>();
    const pi: any = { on: (name: string, fn: Function) => { hooks.set(name, [...hooks.get(name) ?? [], fn]); }, registerMessageRenderer() {}, registerTool: (tool: any) => tools.set(tool.name, tool), registerCommand: (name: string, command: any) => commands.set(name, command), sendMessage: (message: any) => posts.push(message) };
    const sent: any[] = [];
    const adapter = gateCSession(pi, { id: 'self', name: 'Coordinator' }, [{ id: 'peer', name: 'Reviewer' }], async (_to, envelope) => { sent.push(envelope); return 'accepted'; }, root);
    const ctx: any = { isIdle: () => true, hasPendingMessages: () => false, ui: { getEditorText: () => '', setStatus() {}, notify() {} } };
    for (const hook of hooks.get('session_start')!) hook({}, ctx);
    await commands.get('comms').handler('pause', ctx);
    adapter.receive('peer', { id: 'm', exchange: 'x', subject: 'Review', text: 'findings', replyTo: null, corrects: null });
    adapter.tick(); assert.equal(posts.length, 0);
    await commands.get('comms').handler('resume', ctx);
    assert.equal(posts.length, 1); assert.equal(posts[0].customType, 'comms_gate_c_batch');
    const handle = posts[0].content.match(/Return handle: ([^\n]+)/)[1];
    await tools.get('comms_message').execute('call', { respondTo: handle, text: 'received finding' });
    assert.equal(sent[0].replyTo, 'm'); assert.equal(sent[0].exchange, 'x');
    assert.match((await tools.get('fixture_read').execute('read', { file: 'evidence.txt' })).content[0].text, /synthetic source/);
    assert.deepEqual([...tools.keys()], ['comms_peers', 'comms_message', 'comms_inspect', 'fixture_read']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
