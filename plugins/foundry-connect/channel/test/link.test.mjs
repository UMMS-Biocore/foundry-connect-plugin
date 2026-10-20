import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';

const require = createRequire(import.meta.url);
const lib = require('../build/lib.cjs');
const { Server: IOServer } = require('socket.io');

const CRED = 'via_mcp_link_test_value';

const descriptor = {
  sessionId: 'sess-1',
  machine: 'laptop',
  folder: '/work/project',
  startedAt: '2026-10-20T12:00:00.000Z',
  channelVersion: '0.4.0',
};

function fakeServer(version = '2.1.302') {
  const seen = { pushed: [], verdicts: [], notices: [] };
  return {
    seen,
    clientVersion: () => version,
    pushMessage: async (conversationId, text, context) => seen.pushed.push({ conversationId, text, context }),
    sendVerdict: async (requestId, behavior) => seen.verdicts.push({ requestId, behavior }),
    pushNotice: async (text) => seen.notices.push(text),
  };
}

const cleanups = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()();
});

async function startBackend({ middleware } = {}) {
  const httpServer = http.createServer();
  const io = new IOServer(httpServer);
  const nsp = io.of('/claude-channel');
  const state = { handshakes: [], announces: [], sockets: [], replies: [], requests: [] };
  if (middleware) nsp.use(middleware);
  nsp.on('connection', (socket) => {
    state.handshakes.push({ auth: socket.handshake.auth, query: socket.handshake.query, url: socket.handshake.url });
    state.sockets.push(socket);
    socket.on('session:announce', (a) => state.announces.push(a));
    socket.on('reply', (r) => state.replies.push(r));
    socket.on('permission:request', (r) => state.requests.push(r));
  });
  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
  const host = `http://127.0.0.1:${httpServer.address().port}`;
  cleanups.push(() => new Promise((r) => io.close(() => r())));
  return { io, nsp, state, host };
}

const waitFor = async (pred, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('condition not met in time');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function start(backend, server, extra = {}) {
  const link = lib.startLink({
    instanceHost: backend.host,
    token: CRED,
    descriptor,
    server,
    reconnectionDelayMs: 50,
    ...extra,
  });
  cleanups.push(async () => link.stop());
  return link;
}

test('announce carries v 1 and the credential travels in auth only', async () => {
  const backend = await startBackend();
  start(backend, fakeServer());
  await waitFor(() => backend.state.announces.length === 1);
  const a = backend.state.announces[0];
  assert.equal(a.v, 1);
  assert.equal(a.sessionId, 'sess-1');
  assert.equal(a.claudeCodeVersion, '2.1.302');
  assert.ok(!JSON.stringify(a).includes(CRED));
  const h = backend.state.handshakes[0];
  assert.equal(h.auth.token, CRED);
  assert.ok(!JSON.stringify(h.query).includes(CRED));
  assert.ok(!h.url.includes(CRED));
});

test('a reconnect announces again with the same session id', async () => {
  const backend = await startBackend();
  start(backend, fakeServer());
  await waitFor(() => backend.state.announces.length === 1);
  backend.state.sockets[0].conn.close();
  await waitFor(() => backend.state.announces.length === 2);
  assert.equal(backend.state.announces[1].sessionId, backend.state.announces[0].sessionId);
});

test('Claude Code 2.1.233 never announces and gets one notice', async () => {
  const backend = await startBackend();
  const server = fakeServer('2.1.233');
  start(backend, server);
  await sleep(300);
  assert.equal(backend.state.handshakes.length, 0);
  assert.equal(backend.state.announces.length, 0);
  assert.equal(server.seen.notices.length, 1);
  assert.match(server.seen.notices[0], /2\.1\.234/);
});

test('an auth_expired event stops the link after one notice', async () => {
  const backend = await startBackend();
  const server = fakeServer();
  const link = start(backend, server);
  await waitFor(() => backend.state.announces.length === 1);
  backend.state.sockets[0].emit('error', { v: 1, code: 'auth_expired' });
  await waitFor(() => server.seen.notices.length === 1);
  await sleep(400);
  assert.equal(server.seen.notices.length, 1);
  assert.match(server.seen.notices[0], /foundry-channel-login/);
  assert.equal(backend.state.handshakes.length, 1, 'must not reconnect');
  assert.equal(link.stopped(), true);
  await assert.rejects(link.reply(1, 'late'), /sign/i);
});

test('a refused handshake for auth stops after one notice, no retry loop', async () => {
  let attempts = 0;
  const backend = await startBackend({
    middleware: (_socket, next) => {
      attempts++;
      next(new Error('auth_expired'));
    },
  });
  const server = fakeServer();
  start(backend, server);
  await sleep(600);
  assert.equal(attempts, 1);
  assert.equal(server.seen.notices.length, 1);
});

test('permission:verdict from the backend reaches sendVerdict', async () => {
  const backend = await startBackend();
  const server = fakeServer();
  start(backend, server);
  await waitFor(() => backend.state.announces.length === 1);
  backend.state.sockets[0].emit('permission:verdict', { v: 1, requestId: 'abcde', behavior: 'deny' });
  await waitFor(() => server.seen.verdicts.length === 1);
  assert.deepEqual(server.seen.verdicts[0], { requestId: 'abcde', behavior: 'deny' });
});

test('a message from the backend is pushed to Claude; a wrong envelope is ignored', async () => {
  const backend = await startBackend();
  const server = fakeServer();
  start(backend, server);
  await waitFor(() => backend.state.announces.length === 1);
  const socket = backend.state.sockets[0];
  socket.emit('message', { v: 2, conversationId: 3, text: 'future' });
  socket.emit('message', { v: 1, conversationId: 3, text: 'hi', context: { route: '/runs/1', title: 'Run 1', ids: { runId: 1 } } });
  await waitFor(() => server.seen.pushed.length === 1);
  await sleep(50);
  assert.equal(server.seen.pushed.length, 1);
  assert.deepEqual(server.seen.pushed[0], { conversationId: 3, text: 'hi', context: { route: '/runs/1', title: 'Run 1', ids: { runId: 1 } } });
});

test('replies and permission requests go out with v 1', async () => {
  const backend = await startBackend();
  const link = start(backend, fakeServer());
  await waitFor(() => backend.state.announces.length === 1);
  await link.reply(3, 'answer');
  link.permissionRequest({ requestId: 'abcde', toolName: 'Bash', description: 'List files', inputPreview: '{}' });
  await waitFor(() => backend.state.replies.length === 1 && backend.state.requests.length === 1);
  assert.deepEqual(backend.state.replies[0], { v: 1, conversationId: 3, text: 'answer' });
  assert.deepEqual(backend.state.requests[0], { v: 1, requestId: 'abcde', toolName: 'Bash', description: 'List files', inputPreview: '{}' });
});
