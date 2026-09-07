# Connect: Codex IDE extension

**The Codex IDE extension does not take plugins.** OpenAI's own wording is that plugins are not
available in the IDE extension, so the marketplace route in [`codex-cli.md`](codex-cli.md) has
nothing to install into here.

What the extension does share with the CLI is `~/.codex/config.toml`. That is the way in.

## Add the connection

If you have the CLI available, the simplest path is to add the server once with the CLI and let the
extension pick it up from the shared config:

```
codex mcp add foundry --url https://foundry.your-org.edu/mcp
```

Otherwise write the same thing into `~/.codex/config.toml` by hand:

```toml
[mcp_servers.foundry]
url = "https://foundry.your-org.edu/mcp"
```

Restart the extension afterwards so it re-reads the file.

## Authentication

Use `codex mcp login foundry` from the CLI if you have it. For a Personal Access Token, export the
variable and reference it by name so the secret stays out of the config file:

```toml
[mcp_servers.foundry]
url = "https://foundry.your-org.edu/mcp"
bearer_token_env_var = "FOUNDRY_MCP_PAT"
```

The extension has to be launched from an environment where that variable is set, which usually means
exporting it in your shell profile before starting the editor.

## Skills

> **Status: partially verified.** Which directories a given Codex build actually reads is still being
> pinned down, and the published documentation and the installed tooling disagree.

The documented locations are `.agents/skills`, searched from the working directory up to the
repository root, then `$REPO_ROOT/.agents/skills`, then `$HOME/.agents/skills`. The skill installer
that ships inside Codex defaults somewhere else, to `$CODEX_HOME/skills`, normally `~/.codex/skills`,
and on at least one machine only the latter existed.

So if you want the `foundry-pipelines` skill on this surface, copy it explicitly and be prepared to
try both locations:

```
git clone https://github.com/UMMS-Biocore/foundry-connect-plugin
cp -R foundry-connect-plugin/plugins/foundry-connect/skills/foundry-pipelines \
      ~/.agents/skills/foundry-pipelines
```

If it is not picked up, try `~/.codex/skills/` instead. Invoke skills with `$foundry-pipelines`.

The MCP connection above works regardless of where the skill lands. Without the skill you lose the
guided workflow and the confirm-before-write prompts, but the tools are still callable.
