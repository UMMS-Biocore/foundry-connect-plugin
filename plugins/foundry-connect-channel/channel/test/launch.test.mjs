import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { channelEntries, loadedAsChannel, splitCommandLine } = require('../build/lib.cjs');

const claude = (...args) => ['/usr/local/bin/claude', ...args];

test('an ordinary session is not a channel session', () => {
  assert.equal(loadedAsChannel(claude()), false);
  assert.equal(loadedAsChannel(claude('--permission-mode', 'default', '-c')), false);
});

test('the plugin named on --channels or the development flag is a channel session', () => {
  assert.equal(loadedAsChannel(claude('--channels', 'plugin:foundry-connect-channel@foundry-connect')), true);
  assert.equal(loadedAsChannel(claude('--dangerously-load-development-channels', 'plugin:foundry-connect-channel@local')), true);
  assert.equal(loadedAsChannel(claude('--channels=plugin:foundry-connect-channel@any')), true);
});

test('a manually configured server entry names this channel', () => {
  assert.equal(loadedAsChannel(claude('--mcp-config', 'x.json', '--dangerously-load-development-channels', 'server:foundry-channel')), true);
  assert.equal(loadedAsChannel(claude('--channels', 'server:plugin:foundry-connect-channel:foundry-channel')), true);
});

test('another channel, or an untagged value, does not count', () => {
  assert.equal(loadedAsChannel(claude('--channels', 'plugin:telegram@official', 'server:other')), false);
  assert.equal(loadedAsChannel(claude('--channels', 'foundry-connect')), false);
  assert.equal(loadedAsChannel(claude('--channels', 'plugin:foundry-connect')), false);
  assert.equal(loadedAsChannel(claude('--channels', 'plugin:foundry-connect-channel-extra@m')), false);
  // the main plugin no longer carries the channel, so naming it does not start one
  assert.equal(loadedAsChannel(claude('--channels', 'plugin:foundry-connect@foundry-connect')), false);
  assert.equal(loadedAsChannel(claude('--channels', 'server:plugin:foundry-connect:foundry-channel')), false);
});

test('a channel list ends at the next flag, so a later argument is never read as an entry', () => {
  assert.deepEqual(channelEntries(claude('--channels', 'server:a', 'server:b', '--model', 'opus')), ['server:a', 'server:b']);
  assert.equal(loadedAsChannel(claude('--channels', 'server:a', '--add-dir', 'server:foundry-channel')), false);
  assert.equal(loadedAsChannel(claude('--channels', 'server:a', '-p', 'server:foundry-channel')), false);
});

test('a prompt that mentions the flag is not a channel request', () => {
  assert.equal(loadedAsChannel(claude('-p', 'what does --channels plugin:foundry-connect-channel@m do')), false);
});

test('no readable parent command line means not a channel session', () => {
  assert.equal(loadedAsChannel(null), false);
  assert.equal(loadedAsChannel([]), false);
});

test('a ps command line splits on whitespace', () => {
  assert.deepEqual(splitCommandLine('  node /x/cli.js --channels  server:foundry-channel\n'), [
    'node',
    '/x/cli.js',
    '--channels',
    'server:foundry-channel',
  ]);
  assert.deepEqual(splitCommandLine(''), []);
});
