import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const lib = createRequire(import.meta.url)('../build/lib.cjs');

test('envelope version is pinned to 1', () => {
  assert.equal(lib.CLAUDE_CHANNEL_ENVELOPE_VERSION, 1);
});

test('Claude Code version floor is 2.1.234', () => {
  assert.equal(lib.isClaudeCodeVersionSupported('2.1.233'), false);
  assert.equal(lib.isClaudeCodeVersionSupported('2.1.234'), true);
  assert.equal(lib.isClaudeCodeVersionSupported('2.10.0'), true);
  assert.equal(lib.isClaudeCodeVersionSupported('3.0.0'), true);
  assert.equal(lib.isClaudeCodeVersionSupported('1.99.999'), false);
  assert.equal(lib.isClaudeCodeVersionSupported('garbage'), false);
});

test('request id pattern matches the five letter alphabet without l', () => {
  assert.match('abcde', lib.REQUEST_ID_PATTERN);
  assert.doesNotMatch('abcle', lib.REQUEST_ID_PATTERN);
  assert.doesNotMatch('ABCDE', lib.REQUEST_ID_PATTERN);
  assert.doesNotMatch('abcd', lib.REQUEST_ID_PATTERN);
});
