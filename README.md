# foundry-connect

`foundry-connect` connects [ViaFoundry](https://github.com/UMMS-Biocore/viafoundry) — the
bioinformatics pipeline platform — to Claude. It ships a Claude Code plugin (the
`foundry-pipelines` skill plus `/foundry-run`, `/foundry-status`, `/foundry-results` commands) and
per-surface connect guides for the web/desktop apps, all built on ViaFoundry's remote MCP server.
Once connected, you can explore runs, pull result files, analyze data in chat, share results back,
and duplicate/launch pipeline runs — conversationally, from whichever Claude surface you use.

## Surface → path

| Surface | How you connect |
| --- | --- |
| Claude Code (CLI) | plugin, via this marketplace — see [`connect/claude-code.md`](connect/claude-code.md) |
| Claude Code in VS Code | same plugin (needs VS Code extension ≥ v2.1.203 for remote MCP) — see [`connect/claude-code.md`](connect/claude-code.md) |
| claude.ai / Claude for Science | MCP custom connector — see [`connect/claude-ai.md`](connect/claude-ai.md) |
| Claude Desktop | MCP connector (or a `.mcpb` bundle, if your instance provides one) — see [`connect/claude-desktop.md`](connect/claude-desktop.md) |

## Quickstart (~90 seconds, Claude Code)

1. Start a Claude Code session, then type these slash commands at the prompt (not in your
   terminal):

   ```
   /plugin marketplace add UMMS-Biocore/foundry-connect
   /plugin install foundry-connect@foundry-connect
   ```

2. When prompted, enter your **ViaFoundry instance URL** (e.g. `https://foundry.your-org.edu`).
3. First tool call opens a browser to sign in to ViaFoundry (OAuth) — no token to copy.
4. Ask Claude: **"show my last 5 runs"**.
5. Try your first run: **`/foundry-run`** — it duplicates an existing run, lets you edit inputs,
   and launches it, confirming with you before anything is written or executed.

For claude.ai, Claude for Science, or Claude Desktop, see the connect guide for your surface in
[`connect/`](connect/) — those connect ViaFoundry as an MCP connector rather than a plugin.

## Docs

- [`connect/claude-code.md`](connect/claude-code.md) — Claude Code CLI + VS Code
- [`connect/claude-ai.md`](connect/claude-ai.md) — claude.ai / Claude for Science
- [`connect/claude-desktop.md`](connect/claude-desktop.md) — Claude Desktop
- Your ViaFoundry instance's docs (Developer Guides → API Guide → MCP Integration) cover Personal
  Access Tokens and manual client configuration if you need them.

## Safety

Read/inspect actions (listing runs, downloading or loading files, fetching reports) run freely.
Anything that writes or executes — creating a dataset, uploading a file, duplicating a process,
launching a run or app — requires your explicit "yes" to a plain-language summary before Claude
calls it. Nothing is written or run without asking first.

## License

Apache-2.0 — see [`LICENSE`](LICENSE).
