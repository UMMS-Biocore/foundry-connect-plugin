import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bundle = fileURLToPath(new URL('../dist/channel.js', import.meta.url));

test('bundled channel starts and exits when stdin closes', async () => {
  const child = spawn(process.execPath, [bundle], { stdio: ['pipe', 'pipe', 'pipe'] });
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
