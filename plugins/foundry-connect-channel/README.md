# Foundry Connect chat channel plugin

An optional companion to the `foundry-connect` plugin, for Claude Code only. It links a Claude Code
session to the chat drawer in the Foundry Connect web app, so you can talk to the session from the
browser. The `foundry-connect` plugin works without it.

## Setup

1. With the `foundry-connect` marketplace already added, install the plugin with the same
   **hostname only** you gave `foundry-connect`:

   ```
   claude plugin install foundry-connect-channel@foundry-connect --config instance_host=foundry.your-org.edu
   ```

2. Start Claude Code as a channel session:

   ```
   claude --channels plugin:foundry-connect-channel@foundry-connect
   ```

   While the channel is not on the approved list, use
   `--dangerously-load-development-channels plugin:foundry-connect-channel@foundry-connect` instead.

3. Each time the channel starts it opens your browser to sign in (one Approve click when you are
   already signed in to Foundry Connect). The session then appears in the Claude Code list of the
   Foundry Connect chat drawer.

On a machine with no browser, create a personal access token in Foundry Connect and give it to the
optional **`access_token`** plugin option (`/plugin`). Claude Code stores it as a sensitive value,
and the channel then connects with it and skips the browser sign in.

## Commands

- **`/foundry-channel-login`**: signs the running chat channel in again in the browser, for
  example after its sign in expired or was revoked.

## What this plugin runs and sends

The plugin declares one MCP server, **`foundry-channel`** (shown as "Foundry Connect chat").

- Claude Code starts it as a **Node.js process** on your machine, running the bundled
  `channel/dist/channel.js`. Node 22 or later is required, and nothing is downloaded or installed
  at run time. The readable source is outside the plugin, in
  [`channel/src/`](https://github.com/UMMS-Biocore/foundry-connect-plugin/tree/main/channel/src)
  at the repository root, and CI fails when the committed bundle differs from a fresh build of it.
- It does anything only in a session **started as a channel**, that is with
  `--channels plugin:foundry-connect-channel@foundry-connect` (or the development flag above).
  Claude Code does not tell the channel which sessions those are, so it reads the command line
  Claude Code was started with. In every other session it stays idle: it opens no connection,
  does not appear in the drawer, and never opens the browser.
- It opens a **socket connection** (Socket.IO over HTTPS) to your Foundry Connect instance, to the
  same hostname you configured. It does not contact any other host.
- On connect it sends a session descriptor: a random session id, your machine's hostname, the
  folder Claude Code was started in, the start time, and the channel version. After that it
  carries messages you send from the drawer into this session, Claude's replies back to the
  drawer, and tool permission prompts you choose to answer from the drawer.
- Its credential comes from one of two places only: its own browser sign in (OAuth with PKCE, a
  callback on `127.0.0.1`), or the `access_token` plugin option if you chose to fill it in. It
  never reads another tool's saved credentials, and it **never writes a credential to disk**: a
  browser sign in is held in the channel's memory and is gone when the session ends. It is never
  printed, logged or sent to Claude, and it is sent only to the instance you configured.
- The one file it keeps is `~/.config/foundry-connect/channel-client.json` (or under
  `$XDG_CONFIG_HOME`): the public OAuth client id it registered and the loopback port of its
  callback, so a new sign in reuses them. It holds no credential. On start the channel also
  deletes, unread, the `channel.json` sign in file that versions up to 0.7.0 kept. Deleting the
  file does not revoke that older sign in on the server: it stays valid until it expires or you
  revoke it in Foundry Connect.
- **`/foundry-channel-login`** calls the channel's `sign_in` tool, which opens the browser sign in
  again in the running channel. It returns one status line; the outcome arrives as a channel
  notice.
- The environment variables it reads are `FOUNDRY_INSTANCE_HOST` and
  `FOUNDRY_CHANNEL_ACCESS_TOKEN`, which Claude Code sets from the plugin options (the second is
  empty unless you filled in `access_token`), plus `XDG_CONFIG_HOME` and `HOME` to find its
  config folder. It reads no other variable.

If no hostname is configured, the channel stays idle and connects to nothing. Uninstall the plugin,
or disable it from `/mcp`, if you do not use the chat drawer.

## Links

- Documentation: <https://viafoundry.umassmed.edu/docs/developer-guides/using-viafoundry-with-claude/>
- Support: <https://viafoundry.umassmed.edu/docs/resources/contact-support/>
- Privacy policy: <https://viafoundry.umassmed.edu/docs/privacy-policy/>
- License: Apache-2.0
