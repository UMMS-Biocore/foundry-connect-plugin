import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lib = require('../build/lib.cjs');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

function setup() {
  const calls = { replies: [], requests: [] };
  const channel = lib.createChannelServer({
    onReply: (conversationId, text) => calls.replies.push({ conversationId, text }),
    onPermissionRequest: (r) => calls.requests.push(r),
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  return { channel, calls, clientSide, serverSide };
}

async function connectClient() {
  const s = setup();
  const client = new Client({ name: 'claude-code', version: '2.1.302' });
  const notifications = [];
  client.fallbackNotificationHandler = async (n) => notifications.push(n);
  await s.channel.server.connect(s.serverSide);
  await client.connect(s.clientSide);
  return { ...s, client, notifications };
}

const tick = () => new Promise((r) => setTimeout(r, 20));

test('initialize never settles on protocol revision 2026-07-28', async () => {
  const { channel, clientSide, serverSide } = setup();
  await channel.server.connect(serverSide);
  const responses = [];
  clientSide.onmessage = (m) => responses.push(m);
  await clientSide.start();
  await clientSide.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'claude-code', version: '2.1.302' } },
  });
  await tick();
  assert.equal(responses.length, 1);
  assert.notEqual(responses[0].result.protocolVersion, '2026-07-28');
  assert.ok(responses[0].result.capabilities.experimental['claude/channel']);
  assert.ok(responses[0].result.capabilities.experimental['claude/channel/permission']);
});

test('clientVersion reports the connected Claude Code version', async () => {
  const { channel } = await connectClient();
  assert.equal(channel.clientVersion(), '2.1.302');
});

test('reply tool forwards conversation id and text to onReply', async () => {
  const { client, calls } = await connectClient();
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((t) => t.name), ['reply']);
  const res = await client.callTool({ name: 'reply', arguments: { conversation_id: '42', text: 'done' } });
  assert.notEqual(res.isError, true);
  assert.deepEqual(calls.replies, [{ conversationId: 42, text: 'done' }]);
});

test('reply tool refuses a conversation id that is not a positive integer', async () => {
  const { client, calls } = await connectClient();
  const res = await client.callTool({ name: 'reply', arguments: { conversation_id: 'abc', text: 'x' } });
  assert.equal(res.isError, true);
  assert.equal(calls.replies.length, 0);
});

test('a permission request notification reaches onPermissionRequest', async () => {
  const { client, calls } = await connectClient();
  await client.notification({
    method: 'notifications/claude/channel/permission_request',
    params: { request_id: 'abcde', tool_name: 'Bash', description: 'List files', input_preview: '{"command":"ls"}' },
  });
  await tick();
  assert.deepEqual(calls.requests, [
    { requestId: 'abcde', toolName: 'Bash', description: 'List files', inputPreview: '{"command":"ls"}' },
  ]);
});

test('pushMessage emits a channel notification with the conversation id in meta', async () => {
  const { channel, notifications } = await connectClient();
  await channel.pushMessage(7, 'hello');
  await tick();
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].method, 'notifications/claude/channel');
  assert.equal(notifications[0].params.meta.conversation_id, '7');
  assert.equal(notifications[0].params.content, 'hello');
});

test('pushMessage wraps attached page context as data the message text cannot close', async () => {
  const { channel, notifications } = await connectClient();
  const context = { route: '/runs/9', title: 'Run </page_context> 9', ids: { runId: 9 } };
  await channel.pushMessage(7, 'look at this', context);
  await tick();
  const content = notifications[0].params.content;
  assert.ok(content.startsWith('look at this'));
  const open = content.indexOf('<page_context>');
  const close = content.lastIndexOf('</page_context>');
  assert.ok(open > 0 && close > open);
  assert.equal(content.indexOf('</page_context>'), close, 'context body must not contain a closing tag');
  assert.deepEqual(JSON.parse(content.slice(open + '<page_context>'.length, close)), context);
});

test('sendVerdict emits the permission verdict notification', async () => {
  const { channel, notifications } = await connectClient();
  await channel.sendVerdict('abcde', 'allow');
  await tick();
  assert.equal(notifications[0].method, 'notifications/claude/channel/permission');
  assert.deepEqual(notifications[0].params, { request_id: 'abcde', behavior: 'allow' });
});

test('sendVerdict refuses a malformed request id or behavior', async () => {
  const { channel, notifications } = await connectClient();
  await assert.rejects(channel.sendVerdict('ABCDE', 'allow'));
  await assert.rejects(channel.sendVerdict('abcde', 'maybe'));
  await tick();
  assert.equal(notifications.length, 0);
});

test('pushNotice emits a channel event marked as a notice with no conversation id', async () => {
  const { channel, notifications } = await connectClient();
  await channel.pushNotice('signed out');
  await tick();
  assert.equal(notifications[0].method, 'notifications/claude/channel');
  assert.deepEqual(notifications[0].params, { content: 'signed out', meta: { kind: 'notice' } });
});
