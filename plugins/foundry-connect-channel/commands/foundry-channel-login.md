---
description: Sign the Foundry Connect channel in again, for example after it reports that its sign in expired.
allowed-tools: mcp__plugin_foundry-connect-channel_foundry-channel__sign_in
---

Call the `sign_in` tool of the `foundry-channel` MCP server
(`mcp__plugin_foundry-connect-channel_foundry-channel__sign_in`) once, with no arguments.

It opens the Foundry Connect sign in page in the browser and returns one status line at once.
Tell the person to finish signing in in the browser window that opened. When the sign in is
approved, the channel connects by itself and reports it with a channel notice, and the session
appears in the Claude Code list of the Foundry Connect chat drawer.

If the tool returns an error, show the person its one line message and stop. Do not retry in a
loop.
