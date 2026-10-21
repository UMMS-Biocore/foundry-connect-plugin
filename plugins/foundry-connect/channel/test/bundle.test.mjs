import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const bundle = fileURLToPath(new URL('../dist/channel.js', import.meta.url));

// A child environment with an empty config directory and no instance host.
function cleanEnv() {
  const childEnv = { ...process.env, XDG_CONFIG_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'fc-bundle-')) };
  delete childEnv.FOUNDRY_INSTANCE_HOST;
  return childEnv;
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

test('with no instance host the channel tells the person after initialize', async () => {
  const child = spawn(process.execPath, [bundle], { stdio: ['pipe', 'pipe', 'pipe'], env: cleanEnv() });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  const exited = new Promise((r) => child.on('exit', r));
  const send = (m) => child.stdin.write(`${JSON.stringify(m)}\n`);
  const lines = () => out.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  // Wait on the output, not a fixed delay: on a loaded machine the child starts slowly.
  const waitFor = async (find) => {
    for (let waited = 0; waited < 10000; waited += 20) {
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
  const notice = await waitFor((l) => l.method === 'notifications/claude/channel');
  child.stdin.end();
  await exited;
  assert.equal(init?.result?.protocolVersion, '2025-11-25');
  assert.ok(notice, 'expected a notice');
  assert.equal(notice.params.meta.kind, 'notice');
  assert.match(notice.params.content, /no instance host/);
});

test('login subcommand without a host exits 1 with one status line', async () => {
  const child = spawn(process.execPath, [bundle, 'login', '${user_config.instance_host}'], { env: cleanEnv() });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  const code = await new Promise((r) => child.on('exit', r));
  assert.equal(code, 1);
  assert.match(out, /no instance host is set/);
});
