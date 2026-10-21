import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const lib = createRequire(import.meta.url)('../build/lib.cjs');

const ISSUED = 'via_mcp_test_value_that_must_never_be_printed';

// A stand in for the Foundry Connect OAuth endpoints. The authorize step approves at once,
// as a signed in person clicking Approve would.
async function startStubOAuth({ badState = false, omitExpiry = false } = {}) {
  const state = { registrations: [], exchanges: [], challenge: null };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.method === 'POST' && url.pathname === '/api/oauth/v1/register') {
      const meta = JSON.parse(body);
      const clientId = `client-${state.registrations.length + 1}`;
      state.registrations.push({ clientId, redirectUris: meta.redirect_uris });
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ client_id: clientId, redirect_uris: meta.redirect_uris }));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/oauth/v1/authorize') {
      const q = url.searchParams;
      const reg = state.registrations.find((r) => r.clientId === q.get('client_id'));
      if (!reg || !reg.redirectUris.includes(q.get('redirect_uri')) || q.get('code_challenge_method') !== 'S256') {
        res.writeHead(400);
        res.end('bad authorize request');
        return;
      }
      state.challenge = q.get('code_challenge');
      const back = new URL(q.get('redirect_uri'));
      back.searchParams.set('code', 'the-code');
      back.searchParams.set('state', badState ? 'not-the-state' : q.get('state'));
      res.writeHead(302, { location: back.toString() });
      res.end();
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/oauth/v1/token') {
      const form = new URLSearchParams(body);
      state.exchanges.push(Object.fromEntries(form));
      const verifierHash = createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url');
      if (form.get('code') !== 'the-code' || verifierHash !== state.challenge) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      const issued = { access_token: ISSUED, token_type: 'Bearer', expires_in: omitExpiry ? undefined : 7776000, scope: 'mcp' };
      res.end(JSON.stringify(issued));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const host = `http://127.0.0.1:${server.address().port}`;
  return { state, host, close: () => new Promise((r) => server.close(r)) };
}

// The browser: follow the authorize redirect to the loopback callback.
async function fakeBrowser(url) {
  const res = await fetch(url, { redirect: 'follow' });
  await res.text();
}

function captureOutput() {
  const seen = [];
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  const log = console.log;
  const error = console.error;
  process.stdout.write = (c, ...a) => (seen.push(String(c)), out(c, ...a));
  process.stderr.write = (c, ...a) => (seen.push(String(c)), err(c, ...a));
  console.log = (...a) => seen.push(a.join(' '));
  console.error = (...a) => seen.push(a.join(' '));
  return {
    text: () => seen.join(''),
    restore() {
      process.stdout.write = out;
      process.stderr.write = err;
      console.log = log;
      console.error = error;
    },
  };
}

let configDir;
beforeEach(() => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-channel-'));
  process.env.XDG_CONFIG_HOME = configDir;
});

test('stored login path follows XDG_CONFIG_HOME', () => {
  assert.equal(lib.storedLoginPath(), path.join(configDir, 'foundry-connect', 'channel.json'));
});

test('login registers, exchanges with PKCE and saves a 0600 file in a 0700 directory', async () => {
  const stub = await startStubOAuth();
  const cap = captureOutput();
  let saved;
  try {
    saved = await lib.login(stub.host, { openUrl: fakeBrowser, notify: () => {} });
  } finally {
    cap.restore();
    await stub.close();
  }
  assert.equal(stub.state.registrations.length, 1);
  assert.equal(saved.clientId, 'client-1');
  assert.equal(saved.instanceHost, stub.host);
  assert.ok(Date.parse(saved.expiresAt) > Date.now());
  const file = lib.storedLoginPath();
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
  const loaded = lib.loadToken();
  assert.deepEqual(Object.keys(loaded).sort(), ['accessToken', 'clientId', 'expiresAt', 'instanceHost', 'redirectPort']);
  assert.equal(loaded.accessToken, ISSUED);
  assert.ok(!cap.text().includes(ISSUED), 'the issued value was printed');
});

test('notify messages never carry the issued value', async () => {
  const stub = await startStubOAuth();
  const notes = [];
  try {
    await lib.login(stub.host, { openUrl: fakeBrowser, notify: (m) => notes.push(m) });
  } finally {
    await stub.close();
  }
  assert.ok(notes.length > 0);
  assert.ok(notes.every((m) => !m.includes(ISSUED)));
});

test('a second login reuses the client and port when the port is free', async () => {
  const stub = await startStubOAuth();
  try {
    const first = await lib.login(stub.host, { openUrl: fakeBrowser, notify: () => {} });
    const second = await lib.login(stub.host, { openUrl: fakeBrowser, notify: () => {} });
    assert.equal(stub.state.registrations.length, 1);
    assert.equal(second.clientId, first.clientId);
    assert.equal(second.redirectPort, first.redirectPort);
  } finally {
    await stub.close();
  }
});

test('a taken port leads to exactly one re-registration on a new port', async () => {
  const stub = await startStubOAuth();
  const blocker = http.createServer();
  try {
    const first = await lib.login(stub.host, { openUrl: fakeBrowser, notify: () => {} });
    await new Promise((r) => blocker.listen(first.redirectPort, '127.0.0.1', r));
    const second = await lib.login(stub.host, { openUrl: fakeBrowser, notify: () => {} });
    assert.equal(stub.state.registrations.length, 2);
    assert.notEqual(second.redirectPort, first.redirectPort);
    assert.notEqual(second.clientId, first.clientId);
  } finally {
    await new Promise((r) => blocker.close(() => r()));
    await stub.close();
  }
});

test('a state mismatch is refused and nothing is saved', async () => {
  const stub = await startStubOAuth({ badState: true });
  try {
    await assert.rejects(lib.login(stub.host, { openUrl: fakeBrowser, notify: () => {} }), /state/);
  } finally {
    await stub.close();
  }
  assert.equal(stub.state.exchanges.length, 0);
  assert.equal(lib.loadToken(), null);
});

test('a response without expires_in is kept, with the 90 day lifetime assumed', async () => {
  const stub = await startStubOAuth({ omitExpiry: true });
  let saved;
  try {
    saved = await lib.login(stub.host, { openUrl: fakeBrowser, notify: () => {} });
  } finally {
    await stub.close();
  }
  const days = (Date.parse(saved.expiresAt) - Date.now()) / 86_400_000;
  assert.ok(days > 89 && days <= 90, `expected about 90 days, got ${days}`);
  assert.equal(lib.loadToken().accessToken, ISSUED);
});

test('instance base URL: https for a host name, http only for loopback', () => {
  assert.equal(lib.instanceBaseUrl('foundry.example.org'), 'https://foundry.example.org');
  assert.equal(lib.instanceBaseUrl('http://127.0.0.1:8080'), 'http://127.0.0.1:8080');
  assert.equal(lib.instanceBaseUrl('http://localhost:8080/'), 'http://localhost:8080');
  assert.throws(() => lib.instanceBaseUrl('http://foundry.example.org'));
  assert.throws(() => lib.instanceBaseUrl('foundry.example.org/mcp'));
});
