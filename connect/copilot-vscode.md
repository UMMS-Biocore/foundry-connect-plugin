# Connect: Copilot in VS Code

> **Status: not yet verified on this surface.** Everything below follows from VS Code's documented
> behaviour and from what was measured on Copilot CLI, but nobody has run it end to end in VS Code.
> Treat it as a starting point, and please report what actually happens. The
> [Copilot CLI guide](copilot-cli.md) is fully verified if you want a known-good path today.

VS Code auto-detects agent plugins in several manifest formats, including the Claude format
(`.claude-plugin/plugin.json`) that this repository uses, so the same plugin should install without
modification.

## Install

Use the Chat view's plugin picker (`@agentPlugins`), or **Chat: Install Plugin From Source** with
this repository's URL:

```
https://github.com/UMMS-Biocore/foundry-connect-plugin
```

A locally cloned copy can also be pointed at with the `chat.pluginLocations` setting.

## Point it at your instance

This is the open question on this surface. The plugin's server is declared as
`https://${instance_host}/mcp`, and something has to supply `instance_host`.

- On **Claude Code** it is a settings prompt, filled in at install time.
- On **Copilot CLI** it is an ordinary environment variable, verified working.
- On **VS Code** it is untested. The most likely outcome is that it resolves from the environment
  VS Code was launched with, in which case exporting it before launching VS Code (or setting it in
  the terminal profile) is the answer.

If the server does not appear, configure it by hand instead, in your user `mcp.json` or the
workspace `.vscode/mcp.json`, with the hostname written out in full:

```json
{
  "servers": {
    "foundry": {
      "type": "http",
      "url": "https://foundry.your-org.edu/mcp"
    }
  }
}
```

That form needs no variable at all and is the reliable fallback.

## Authentication

VS Code supports OAuth with dynamic client registration for remote MCP servers, so the first tool
call should open a browser to sign in to Foundry Connect, with no token to copy.

If your instance predates the OAuth build, use a Personal Access Token (your Foundry Connect account,
then Personal Access Tokens; it starts with `via_mcp_`) and send it as an
`X-Foundry-Connect-Token` header on the manual server entry above.

## Check it worked

Open the MCP servers view from the Chat view and confirm a server named `foundry` is listed and
connected, then ask "show my last 5 runs".

## Note for Claude Code users in VS Code

If you are running **Claude Code inside VS Code** rather than Copilot, that is a different product
and a different path. See [`claude-code.md`](claude-code.md).
