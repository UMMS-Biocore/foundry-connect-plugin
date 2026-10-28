---
description: Sign the Foundry Connect channel in again, for example after it reports that its sign in expired.
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/channel/dist/channel.js login:*)
---

Run this command with the Bash tool, exactly as written:

```bash
node "${CLAUDE_PLUGIN_ROOT}/channel/dist/channel.js" login "${user_config.instance_host}"
```

It opens the Foundry Connect sign in page in the browser and waits until the person approves
it there (up to ten minutes). Tell the person to finish signing in in the browser window that
opened. The command prints only a status line; it never prints the stored sign in.

When it reports that sign in finished, the running channel reconnects by itself within a few
seconds, and the session appears in the Claude Code list of the Foundry Connect chat drawer.
If it fails, show the person its one line error and stop. Do not retry in a loop.
