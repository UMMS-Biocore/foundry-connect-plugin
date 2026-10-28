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

3. On its first start the channel opens your browser once to sign in. The session then appears in
   the Claude Code list of the Foundry Connect chat drawer.

## Commands

- **`/foundry-channel-login`**: signs the chat channel in again, for example after its sign in
  expired.

## What this plugin runs and sends

The plugin declares one MCP server, **`foundry-channel`** (shown as "Foundry Connect chat").

- Claude Code starts it as a **Node.js process** on your machine, running the bundled
  `channel/dist/channel.js`. Node 18 or later is required, and nothing is downloaded or installed
  at run time. The readable source is in `channel/src/`, and CI fails when the committed bundle
  differs from a fresh build of it.
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
- Its sign in comes from its own browser sign in, never from another tool's saved credentials.
  The result is **stored** in `~/.config/foundry-connect/channel.json` (or under
  `$XDG_CONFIG_HOME`) with owner only permissions. It is never printed, logged or sent to Claude,
  and it works only against the instance it was issued for.
- **`/foundry-channel-login`** runs `node channel/dist/channel.js login` to sign in again. It prints
  status lines only. The running channel picks up the new sign in within a few seconds.

If no hostname is configured, the channel stays idle and connects to nothing. Uninstall the plugin,
or disable it from `/mcp`, if you do not use the chat drawer.

## Links

- Documentation: <https://viafoundry.umassmed.edu/docs/developer-guides/using-viafoundry-with-claude/>
- Support: <https://viafoundry.umassmed.edu/docs/resources/contact-support/>
- Privacy policy: <https://viafoundry.umassmed.edu/docs/privacy-policy/>
- License: Apache-2.0
