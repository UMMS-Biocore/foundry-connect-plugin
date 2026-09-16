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

OAuth is the default, with no token to copy. If you added the server with `codex mcp add` above,
you are already signed in: that command detects OAuth, opens your browser, and finishes the sign-in
before it returns. The extension uses the same stored sign-in as the CLI.

If you wrote `config.toml` by hand instead, sign in once from the CLI:

```
codex mcp login foundry
```

Approve the connection in the browser. The browser is then sent to `http://127.0.0.1:<port>/callback`,
which is Codex receiving the result on your own machine. If that tab says the site can't be reached
but the terminal reports success, you are signed in. The [Codex CLI guide](codex-cli.md#add-the-connection-and-sign-in)
explains that tab, and why the browser and Codex must be on the same machine.

Check first that your instance supports OAuth for Codex, as described in
[the CLI guide](codex-cli.md#check-your-instance-supports-oauth). If it does not, use a Personal
Access Token. Export the variable and reference it by name so the secret stays out of the config
file:

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
