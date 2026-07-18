# Connect: Claude Code (CLI + VS Code)

Two ways to get ViaFoundry into Claude Code. Use the plugin if you want the `foundry-pipelines`
skill and the `/foundry-*` commands along with the MCP server; use MCP-only if you just want the
tools.

## Option A: install the plugin (recommended)

Inside a Claude Code session (type these at the Claude Code prompt, not in your terminal):

```
/plugin marketplace add UMMS-Biocore/foundry-connect
/plugin install foundry-connect@foundry-connect
```

Claude will prompt for your **ViaFoundry instance URL** (e.g. `https://foundry.your-org.edu`, no
trailing slash) — this is the plugin's `instance_url` setting, and it's what the bundled MCP
config uses to build `<instance_url>/mcp`.

This installs, in one step:

- the `foundry-pipelines` skill (explore/analyze/share-back/author/execute/apps, with confirm-
  before-write built in)
- the `/foundry-run`, `/foundry-status`, `/foundry-results` slash commands
- the `foundry` remote MCP server pointed at your instance

The first tool call opens a browser window for you to sign in to ViaFoundry (OAuth) — you don't
need to create or paste a token.

Verify with `claude plugin list` (plugin enabled) and `claude mcp list` or `/mcp` in a session
(the `foundry` server registered).

## Option B: MCP only (no plugin)

If you don't want the skill/commands, add just the MCP server:

```bash
claude mcp add --transport http foundry https://<your-instance>/mcp
```

Replace `<your-instance>` with your ViaFoundry base URL. This also triggers the OAuth browser
sign-in on first use — no manual token needed.

## VS Code (Claude Code extension)

Both options above work inside the Claude Code extension for VS Code, but **remote MCP servers
require VS Code extension version 2.1.203 or later**. Update the extension first if `/mcp` or the
plugin's tools don't show up.

## PAT fallback (no OAuth)

If your ViaFoundry instance doesn't have the OAuth build yet, authenticate with a Personal Access
Token instead. Create one in ViaFoundry (your account → Personal Access Tokens) — it will start
with `via_mcp_`. Add the server manually (Option B) with an explicit header instead of using the
plugin's bundled server, which currently only supports the OAuth flow:

```bash
claude mcp add --transport http foundry https://<your-instance>/mcp \
  --header "X-ViaFoundry-Token: via_mcp_..."
```

You still get the same MCP tools this way, under the same `foundry` server name — just via a
token instead of a browser sign-in.
