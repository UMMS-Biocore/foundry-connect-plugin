import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const bundle = fileURLToPath(
  new URL('../../plugins/foundry-connect-channel/channel/dist/channel.js', import.meta.url),
);

// A child environment with an empty config directory and no instance host. Only the
// variables the channel needs are passed, never the rest of the parent environment.
function cleanEnv() {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    XDG_CONFIG_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'fc-bundle-')),
  };
}

test('bundled channel starts and exits when stdin closes', async () => {
  const child = spawn(process.execPath, [bundle], { stdio: ['pipe', 'pipe', 'pipe'], env: cleanEnv() });
  let stderr = '';
  child.stderr.on('data', (d) => (stderr += d));
  const exited = new Promise((resolve) => child.on('exit', resolve));
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(child.exitCode, null, `channel exited early: ${stderr}`);
  child.stdin.end();
  let timer;
  const code = await Promise.race([
    exited,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('channel did not exit after stdin closed')), 5000);
    }),
  ]);
  clearTimeout(timer);
  assert.equal(code, 0, stderr);
});

// Starts the bundle the way Claude Code does for a channel session: as the child of a
// process whose command line names this channel.
function spawnAsChannel(env = {}) {
  const relay = "require('child_process').spawn(process.execPath,[process.argv[1]],{stdio:'inherit'}).on('exit',(c)=>process.exit(c??1))";
  return spawn(process.execPath, ['-e', relay, '--', bundle, '--channels', 'server:foundry-channel'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...cleanEnv(), ...env },
  });
}

// Sends initialize and initialized, then waits up to `ms` for a channel notification.
async function channelNoticeAfterInitialize(child, ms) {
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  const exited = new Promise((r) => child.on('exit', r));
  const send = (m) => child.stdin.write(`${JSON.stringify(m)}\n`);
  const lines = () => out.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  // Wait on the output, not a fixed delay: on a loaded machine the child starts slowly.
  const waitFor = async (find, limit = 10000) => {
    for (let waited = 0; waited < limit; waited += 20) {
      const hit = lines().find(find);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 20));
    }
    return undefined;
  };
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'claude-code', version: '2.1.302' } },
  });
  const init = await waitFor((l) => l.id === 1);
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const notice = await waitFor((l) => l.method === 'notifications/claude/channel', ms);
  child.stdin.end();
  await exited;
  assert.equal(init?.result?.protocolVersion, '2025-11-25');
  return notice;
}

test('with no instance host the channel tells the person after initialize', async () => {
  const notice = await channelNoticeAfterInitialize(spawnAsChannel(), 10000);
  assert.ok(notice, 'expected a notice');
  assert.equal(notice.params.meta.kind, 'notice');
  assert.match(notice.params.content, /no instance host/);
});

// Node without a global WebSocket (older than 22) is simulated by switching it off.
test('without a global WebSocket the channel says it needs Node 22', async () => {
  const child = spawnAsChannel({ NODE_OPTIONS: '--no-experimental-websocket' });
  const notice = await channelNoticeAfterInitialize(child, 10000);
  assert.ok(notice, 'expected a notice');
  assert.equal(notice.params.meta.kind, 'notice');
  assert.match(notice.params.content, /needs Node 22 or later/);
});

test('a session not started with the channel flag stays silent after initialize', async () => {
  const child = spawn(process.execPath, [bundle], { stdio: ['pipe', 'pipe', 'pipe'], env: cleanEnv() });
  assert.equal(await channelNoticeAfterInitialize(child, 1500), undefined);
});

// A loopback address nothing listens on.
async function closedLoopbackHost() {
  const net = await import('node:net');
  const s = net.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return `http://127.0.0.1:${port}`;
}

test('the bundle stays under the plugin directory 256 KiB file limit', () => {
  assert.ok(fs.statSync(bundle).size < 256 * 1024, `bundle is ${fs.statSync(bundle).size} bytes`);
});

test('the 0.7.0 sign in file is removed even in a session not started as a channel', async () => {
  const env = cleanEnv();
  const legacy = path.join(env.XDG_CONFIG_HOME, 'foundry-connect', 'channel.json');
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, '{}\n');
  const child = spawn(process.execPath, [bundle], { stdio: ['pipe', 'pipe', 'pipe'], env });
  assert.equal(await channelNoticeAfterInitialize(child, 500), undefined);
  assert.equal(fs.existsSync(legacy), false);
});

test('a channel start with no configured credential signs in, and removes the 0.7.0 file', async () => {
  const env = cleanEnv();
  const legacy = path.join(env.XDG_CONFIG_HOME, 'foundry-connect', 'channel.json');
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, '{}\n');
  const child = spawnAsChannel({ ...env, FOUNDRY_INSTANCE_HOST: await closedLoopbackHost() });
  const notice = await channelNoticeAfterInitialize(child, 10000);
  assert.ok(notice, 'expected a notice');
  // registration against the closed port fails before any browser opens
  assert.match(notice.params.content, /sign in did not finish/);
  assert.equal(fs.existsSync(legacy), false);
});

test('a configured credential goes to the configured instance in the handshake, without a sign in, and is never printed', async () => {
  const configured = 'via_mcp_configured_value_that_must_never_be_printed';
  const seenHttp = [];
  const httpServer = http.createServer((req, res) => {
    // any plain HTTP request (such as an OAuth registration) would mean a sign in started
    seenHttp.push(req.url);
    res.writeHead(404);
    res.end();
  });
  const io = new IOServer(httpServer);
  const handshakes = [];
  io.of('/claude-channel').use((socket, next) => {
    handshakes.push(socket.handshake.auth?.token === configured);
    next(new Error('auth_expired'));
  });
  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
  try {
    const child = spawnAsChannel({
      FOUNDRY_INSTANCE_HOST: `http://127.0.0.1:${httpServer.address().port}`,
      FOUNDRY_CHANNEL_ACCESS_TOKEN: configured,
    });
    let printed = '';
    child.stdout.on('data', (d) => (printed += d));
    child.stderr.on('data', (d) => (printed += d));
    // the refused handshake stops the link with one notice
    const notice = await channelNoticeAfterInitialize(child, 10000);
    assert.match(notice?.params?.content ?? '', /expired or was revoked/);
    assert.deepEqual(handshakes, [true]);
    assert.ok(!seenHttp.some((u) => u.startsWith('/api/oauth')), 'a browser sign in was started');
    assert.ok(!printed.includes(configured), 'the configured value was printed');
  } finally {
    await new Promise((r) => io.close(() => r()));
  }
});

test('an unfilled credential option counts as unset', async () => {
  const child = spawnAsChannel({
    FOUNDRY_INSTANCE_HOST: await closedLoopbackHost(),
    FOUNDRY_CHANNEL_ACCESS_TOKEN: '${user_config.access_token}',
  });
  const notice = await channelNoticeAfterInitialize(child, 10000);
  assert.match(notice?.params?.content ?? '', /sign in did not finish/);
});
