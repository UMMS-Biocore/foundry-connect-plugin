# Connect: Codex CLI

Codex takes this repository as a plugin marketplace and installs the skill and command wrappers from
it. **The connection itself is added separately**, with one command, because Codex cannot resolve a
per-customer address out of a bundled plugin.

Measured against `codex-cli 0.153.0`.

## First, find the binary

There is often **no `codex` on your PATH**, even with Codex installed. On macOS the working CLI ships
inside the VS Code extension:

```
~/.vscode/extensions/openai.chatgpt-<version>-darwin-arm64/bin/macos-aarch64/codex
```

Either call that path directly or put it on your PATH. Do not assume a `codex` command exists, and do
not rely on a desktop app being installed, since macOS users are being migrated to the ChatGPT
desktop app.

## Install the skills

```
codex plugin marketplace add UMMS-Biocore/foundry-connect-plugin
codex plugin add foundry-connect@foundry-connect
```

That gives you the `foundry-pipelines` skill and the three command wrappers.

## Add the connection

Codex stores a bundled server's URL **exactly as written** and never expands variables in it, so the
plugin's own entry cannot point at your instance. Add the real one yourself:

```
codex mcp add foundry --url https://foundry.your-org.edu/mcp
```

Use your own hostname, keep the `/mcp` on the end, and keep the name `foundry`. A server you add
this way **takes precedence over the plugin's unusable entry of the same name**, so the plugin's
placeholder disappears from the list once yours exists.

Confirm:

```
codex mcp list
```

The `Url` column must show your real hostname. If it still shows `https://${instance_host}/mcp`, the
manual add did not happen and nothing will connect.

## Authentication

```
codex mcp login foundry
```

If your instance predates the OAuth build, use a Personal Access Token instead (your Foundry Connect
account, then Personal Access Tokens; it starts with `via_mcp_`). Export it, then add the server so
it reads the variable by name rather than storing the secret:

```
export FOUNDRY_MCP_PAT=via_mcp_...
codex mcp add foundry --url https://foundry.your-org.edu/mcp --bearer-token-env-var FOUNDRY_MCP_PAT
```

Codex sends it as `Authorization: Bearer <token>`, which Foundry Connect accepts alongside the
`X-Foundry-Connect-Token` header.

## Optional: scope approvals to this server

Codex can require confirmation for Foundry Connect tools without changing your global policy. In
`~/.codex/config.toml`:

```toml
[mcp_servers.foundry]
url = "https://foundry.your-org.edu/mcp"
default_tools_approval_mode = "prompt"
```

Valid values are `auto`, `prompt`, `writes` and `approve`. A single tool can be set separately:

```toml
[mcp_servers.foundry.tools.list_runs]
approval_mode = "auto"
```

**Check your spelling, then check it again.** A key Codex does not recognise is dropped **silently**,
with no warning, and the setting simply falls back to your global policy. Verify with:

```
codex mcp get foundry
```

and confirm the `default_tools_approval_mode` line is actually present. Note that `codex mcp get`
shows the server level setting but **not** per-tool overrides.

## Codex IDE extension

The IDE extension takes no plugins at all. See [`codex-ide.md`](codex-ide.md).
