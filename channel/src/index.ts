import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadedAsChannel, parentArgv } from './launch.js';
import { startLink, type Link } from './link.js';
import { login } from './login.js';
import { CHANNEL_VERSION, createChannelServer } from './server.js';
import { isUsable, loadToken, storedLoginPath } from './token-store.js';

// An unset plugin option can reach us as the literal placeholder; treat it as unset.
function configuredHost(raw: string | undefined): string {
  const v = (raw ?? '').trim();
  return v && !v.includes('${') ? v : '';
}

// `node channel.js login [host]`: what /foundry-channel-login runs through Bash. Prints
// status lines only.
async function runLoginCommand(arg: string | undefined): Promise<void> {
  const host = configuredHost(arg) || configuredHost(process.env.FOUNDRY_INSTANCE_HOST) || loadToken()?.instanceHost || '';
  if (!host) {
    process.stdout.write('Foundry Connect: no instance host is set. Set it in the plugin options (/plugin) and try again.\n');
    process.exit(1);
  }
  try {
    await login(host, { notify: (m) => process.stdout.write(`${m}\n`) });
    process.exit(0);
  } catch (err) {
    process.stdout.write(`Foundry Connect: sign in failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

async function runChannel(): Promise<void> {
  const host = configuredHost(process.env.FOUNDRY_INSTANCE_HOST);
  const asChannel = loadedAsChannel(parentArgv());
  const descriptor = {
    sessionId: randomUUID(),
    machine: os.hostname(),
    folder: process.cwd(),
    startedAt: new Date().toISOString(),
    channelVersion: CHANNEL_VERSION,
  };
  let link: Link | null = null;

  const channel = createChannelServer({
    onReply: async (conversationId, text) => {
      if (!asChannel) throw new Error('this Claude Code session was not started with the Foundry Connect chat channel.');
      if (!link) throw new Error('the channel is not connected to Foundry Connect. Run /foundry-channel-login.');
      await link.reply(conversationId, text);
    },
    onPermissionRequest: (r) => link?.permissionRequest(r),
  });

  const connect = (): boolean => {
    const stored = loadToken();
    if (!isUsable(stored, host) || (link && !link.stopped())) return false;
    link = startLink({ instanceHost: host, token: stored.accessToken, descriptor, server: channel });
    return true;
  };

  const shutdown = () => {
    link?.stop();
    fs.unwatchFile(storedLoginPath());
    process.exit(0);
  };
  const transport = new StdioServerTransport();
  transport.onclose = shutdown;
  process.stdin.on('end', shutdown);

  channel.server.oninitialized = () => {
    // Not started as a channel: Claude Code drops our messages, so connecting would list a
    // drawer session nobody can reach, and signing in would open a browser for nothing.
    if (!asChannel) return;
    if (!host) {
      channel
        .pushNotice('Foundry Connect channel: no instance host is set, so the channel is idle. Set it in the plugin options (/plugin) and restart Claude Code.')
        .catch(() => {});
      return;
    }
    // A new or renewed sign in (from /foundry-channel-login) is picked up here.
    fs.watchFile(storedLoginPath(), { interval: 2000 }, () => {
      connect();
    });
    if (connect()) return;
    if (loadToken()) {
      channel
        .pushNotice('Foundry Connect channel: the stored sign in expired or belongs to another instance. Run /foundry-channel-login to sign in.')
        .catch(() => {});
      return;
    }
    // First start with no sign in at all: open the browser once, never in a loop.
    login(host, { notify: (m) => channel.pushNotice(m).catch(() => {}) }).catch((err: unknown) => {
      channel
        .pushNotice(`Foundry Connect channel: sign in did not finish (${err instanceof Error ? err.message : String(err)}). Run /foundry-channel-login to try again.`)
        .catch(() => {});
    });
  };

  await channel.server.connect(transport);
}

const main = process.argv[2] === 'login' ? () => runLoginCommand(process.argv[3]) : runChannel;
main().catch((err: unknown) => {
  process.stderr.write(`foundry-channel: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
