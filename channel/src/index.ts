import { randomUUID } from 'node:crypto';
import os from 'node:os';

import { removeLegacySignInFile } from './client-store.js';
import { loadedAsChannel, parentArgv } from './launch.js';
import { startLink, type Link } from './link.js';
import { configuredOption, login, openInBrowser } from './login.js';
import { StdioTransport } from './mcp.js';
import { CHANNEL_VERSION, createChannelServer } from './server.js';

async function runChannel(): Promise<void> {
  // Before any check that could leave the channel idle, so the old file goes in every session.
  removeLegacySignInFile();
  const host = configuredOption(process.env.FOUNDRY_INSTANCE_HOST);
  // Optional: a personal access token the person chose to give the plugin options (stored by
  // Claude Code as a sensitive value). Without one the channel signs in through the browser.
  const configuredCredential = configuredOption(process.env.FOUNDRY_CHANNEL_ACCESS_TOKEN);
  const asChannel = loadedAsChannel(parentArgv());
  const descriptor = {
    sessionId: randomUUID(),
    machine: os.hostname(),
    folder: process.cwd(),
    startedAt: new Date().toISOString(),
    channelVersion: CHANNEL_VERSION,
  };
  let link: Link | null = null;
  // The authorize page of the sign in waiting in the browser, '' while none is.
  let pendingAuthorizeUrl = '';
  let signingIn = false;

  // Why the channel cannot do anything right now, or '' when it can.
  const idleReason = (): string => {
    if (!asChannel) return 'this Claude Code session was not started with the Foundry Connect chat channel.';
    if (typeof globalThis.WebSocket !== 'function') {
      return `the channel needs Node 22 or later, and this is Node ${process.versions.node}. Update Node and restart Claude Code.`;
    }
    if (!host) return 'no instance host is set. Set it in the plugin options (/plugin) and restart Claude Code.';
    return '';
  };

  const channel = createChannelServer({
    onReply: async (conversationId, text) => {
      const idle = idleReason();
      if (idle) throw new Error(idle);
      if (!link) throw new Error('the channel is not connected to Foundry Connect. Run /foundry-channel-login.');
      await link.reply(conversationId, text);
    },
    onPermissionRequest: (r) => link?.permissionRequest(r),
    onSignIn: () => {
      const idle = idleReason();
      if (idle) throw new Error(idle);
      return signIn();
    },
  });

  const notice = (text: string) => {
    channel.pushNotice(text).catch(() => {});
  };

  // Only ever replaces a link that has stopped: a live one keeps its session id on the
  // server, and a second link announcing the same id would be refused as session_id_in_use.
  const connectWith = (credential: string) => {
    if (link && !link.stopped()) return;
    link = startLink({ instanceHost: host, token: credential, descriptor, server: channel });
  };

  // One browser sign in at a time. The credential it returns goes straight into the link and
  // is kept nowhere else.
  const signIn = (): string => {
    if (link && !link.stopped()) {
      throw new Error(
        'the channel is already connected to Foundry Connect, or is retrying a dropped connection, so there is nothing to sign in again. Restart Claude Code to start over.',
      );
    }
    if (signingIn) {
      // The tab may have been closed: open the same page again rather than wait out the timeout.
      if (pendingAuthorizeUrl) openInBrowser(pendingAuthorizeUrl);
      return 'A sign in is already waiting, so its page was opened in the browser again. Finish it there.';
    }
    signingIn = true;
    const openUrl = (url: string) => {
      pendingAuthorizeUrl = url;
      openInBrowser(url);
    };
    login(host, { notify: notice, openUrl })
      .then((result) => connectWith(result.accessToken))
      .catch((err: unknown) => {
        notice(`Foundry Connect channel: sign in did not finish (${err instanceof Error ? err.message : String(err)}). Run /foundry-channel-login to try again.`);
      })
      .finally(() => {
        signingIn = false;
        pendingAuthorizeUrl = '';
      });
    return 'Opening the browser to sign in to Foundry Connect. The channel connects once the sign in is approved there.';
  };

  const shutdown = () => {
    link?.stop();
    process.exit(0);
  };
  const transport = new StdioTransport();
  transport.onclose = shutdown;
  process.stdin.on('end', shutdown);

  channel.server.oninitialized = () => {
    // Not started as a channel: Claude Code drops our messages, so connecting would list a
    // drawer session nobody can reach, and signing in would open a browser for nothing.
    if (!asChannel) return;
    const idle = idleReason();
    if (idle) {
      notice(`Foundry Connect channel: ${idle} The channel is idle.`);
      return;
    }
    if (configuredCredential) {
      connectWith(configuredCredential);
      return;
    }
    signIn();
  };

  await channel.server.connect(transport);
}

runChannel().catch((err: unknown) => {
  process.stderr.write(`foundry-channel: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
