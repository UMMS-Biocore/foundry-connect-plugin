# foundry-connect

`foundry-connect` connects [Foundry Connect](https://github.com/UMMS-Biocore/foundry-connect), the
bioinformatics pipeline platform, to the assistant you already work in. It ships one plugin (the
`foundry-pipelines` skill plus `/foundry-run`, `/foundry-status`, `/foundry-results` commands) that
installs on Claude Code, GitHub Copilot and Codex, plus per-surface connect guides for the web and
desktop apps, all built on Foundry Connect's remote MCP server. Once connected, you can explore runs,
pull result files, analyze data in chat, share results back, and duplicate or launch pipeline runs,
conversationally, from whichever assistant you use.

## Surface → path

| Provider | Surface | How you connect | Guide | Status |
| --- | --- | --- | --- | --- |
| Anthropic | Claude Code (CLI) | plugin, from this marketplace | [`claude-code.md`](connect/claude-code.md) | supported |
| Anthropic | Claude Code in VS Code | same plugin (needs the VS Code extension at v2.1.203 or later for remote MCP) | [`claude-code.md`](connect/claude-code.md) | supported |
| Anthropic | claude.ai and Claude for Science | MCP custom connector | [`claude-ai.md`](connect/claude-ai.md) | supported |
| Anthropic | Claude Desktop | MCP connector, or a `.mcpb` bundle if your instance provides one | [`claude-desktop.md`](connect/claude-desktop.md) | supported |
| GitHub | Copilot CLI | same plugin, plus `instance_host` as an environment variable | [`copilot-cli.md`](connect/copilot-cli.md) | supported |
| GitHub | Copilot in VS Code | same plugin, with a manual `mcp.json` entry as the fallback | [`copilot-vscode.md`](connect/copilot-vscode.md) | **not yet verified** |
| OpenAI | Codex CLI | plugin for the skills, plus one `codex mcp add` for the connection | [`codex-cli.md`](connect/codex-cli.md) | supported |
| OpenAI | Codex IDE extension | no plugins on this surface; the shared `~/.codex/config.toml` | [`codex-ide.md`](connect/codex-ide.md) | connection supported, skills partial |
| OpenAI | ChatGPT web | no self-serve path today | [`chatgpt.md`](connect/chatgpt.md) | **not available** |

One plugin covers Claude Code, Copilot and Codex. What differs per host is only **how the instance
address reaches it**: a settings prompt on Claude Code, an environment variable on Copilot, and a
separate `codex mcp add` on Codex, which cannot resolve a variable inside a bundled server URL.

## Signing in: OAuth first, token as the fallback

Every surface that supports it signs in with **OAuth**: the first connection opens a browser, you
sign in to Foundry Connect and click **Approve**, and the client stores the result. There is no
token to create or paste.

| Surface | When the browser sign-in happens |
| --- | --- |
| Claude Code, CLI and VS Code | first Foundry Connect tool call |
| claude.ai, Claude for Science, Claude Desktop | when you click **Connect** on the connector |
| Copilot CLI and Copilot in VS Code | first Foundry Connect tool call, in an interactive session |
| Codex CLI and Codex IDE extension | during `codex mcp add` itself; `codex mcp login` only to sign in again |

Codex needs an instance that answers the path-suffixed discovery URL. Check yours with:

```
curl -s https://<hostname>/.well-known/oauth-protected-resource/mcp
```

JSON back means OAuth works on every surface above. HTML or a 404 means the instance predates that
fix, so use a **Personal Access Token** (your Foundry Connect account, then Personal Access Tokens;
it starts with `via_mcp_`). Each guide shows how to supply one.

Terminal clients such as Codex and Claude Code finish the sign-in by sending your browser to
`http://127.0.0.1:<port>/...` or `http://localhost:<port>/...`. That is the client on your own
machine receiving the result, not a misconfigured server, so the browser and the client must run on
the same machine.

## Quickstart (~90 seconds, Claude Code)

1. Start a Claude Code session, then type these slash commands at the prompt (not in your
   terminal):

   ```
   /plugin marketplace add UMMS-Biocore/foundry-connect-plugin
   /plugin install foundry-connect@foundry-connect
   ```

2. When prompted, enter your **Foundry Connect instance hostname**, e.g. `foundry.your-org.edu`.
   Hostname only: no `https://`, no trailing slash, and **no `/mcp` on the end**. The plugin builds
   `https://<hostname>/mcp` itself, so pasting the connector URL from **Profile, then Connect to
   Claude** (which is a full URL already ending in `/mcp`) produces a broken address.
   Plugin versions before 0.2.0 called this setting `instance_url` and wanted the full base URL
   including the scheme. Upgrading prompts once for the hostname.
3. **Restart your Claude Code session.** Plugin-provided MCP servers load at session start, so the
   plugin you just installed isn't connected until you exit and run `claude` again. Skipping this is
   the most common reason the plugin looks installed but Foundry Connect never appears.
4. Run `/mcp`. You should see a server named **`foundry`**, connected. If it shows `viafoundry`
   instead, that's an older manual `claude mcp add` connection rather than this plugin. Both work,
   but remove the old one with `claude mcp remove viafoundry` so you don't end up with two servers
   exposing the same tools.
5. The first tool call opens a browser to sign in to Foundry Connect (OAuth), with no token to
   copy.
6. Ask Claude: **"show my last 5 runs"**.
7. Try your first run with **`/foundry-run`**. It duplicates an existing run, lets you edit
   inputs, and launches it, confirming with you before anything is written or executed.

Working somewhere else? Every surface has its own guide in [`connect/`](connect/), including
Copilot CLI, Codex CLI and the web and desktop apps. The Claude web and desktop apps connect Foundry
Connect as an MCP connector rather than as a plugin.

## Docs

**Anthropic**

- [`connect/claude-code.md`](connect/claude-code.md), Claude Code CLI and VS Code
- [`connect/claude-ai.md`](connect/claude-ai.md), claude.ai and Claude for Science
- [`connect/claude-desktop.md`](connect/claude-desktop.md), Claude Desktop

**GitHub Copilot**

- [`connect/copilot-cli.md`](connect/copilot-cli.md), Copilot CLI
- [`connect/copilot-vscode.md`](connect/copilot-vscode.md), Copilot in VS Code (not yet verified)

**OpenAI**

- [`connect/codex-cli.md`](connect/codex-cli.md), Codex CLI
- [`connect/codex-ide.md`](connect/codex-ide.md), Codex IDE extension
- [`connect/chatgpt.md`](connect/chatgpt.md), ChatGPT web and why there is no self-serve path

**Your instance**

- Your Foundry Connect instance's docs (Developer Guides, then API Guide, then MCP Integration) cover
  Personal Access Tokens and manual client configuration if you need them.

## Safety

Read and inspect actions (listing runs, downloading or loading files, fetching reports) run freely.
Anything that writes or executes, such as creating a dataset, uploading a file, duplicating a
process, or launching a run or app, requires your explicit "yes" to a plain-language summary before
the assistant calls it. Nothing is written or run without asking first.

This is enforced by the skill on every host. Codex users can additionally have the client itself
prompt on Foundry Connect tools, scoped to this server alone. See
[`connect/codex-cli.md`](connect/codex-cli.md).

## License

Apache-2.0. See [`LICENSE`](LICENSE).
