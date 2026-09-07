# Connect: GitHub Copilot CLI

Copilot CLI reads this repository as a plugin marketplace and installs the same plugin Claude Code
uses. You get the `foundry-pipelines` skill, the three `/foundry-*` command wrappers, and the
`foundry` MCP server, all from one install.

Measured against `GitHub Copilot CLI 1.0.83`.

## Install

```
copilot plugin marketplace add UMMS-Biocore/foundry-connect-plugin
copilot plugin install foundry-connect@foundry-connect
```

## Point it at your instance

Copilot has no per-plugin settings prompt, so the instance is supplied as an **environment
variable** rather than typed into a dialog. Set `instance_host` to your **hostname only**:

```
export instance_host=foundry.your-org.edu
```

No `https://`, no trailing slash, no `/mcp`. The plugin builds `https://<instance_host>/mcp` itself.
Put the `export` in your shell profile so it survives new terminals, because a session without the
variable set cannot reach your instance.

Then **start a new Copilot session**. MCP servers are read at session start, so the plugin you just
installed is not connected until you restart.

## Check it worked

```
copilot mcp list
```

You should see:

```
Plugin servers:
  foundry (http)
```

If the `Plugin servers` section is missing entirely, the server was rejected. See troubleshooting
below.

For the full picture across kinds, use the plural form, which is the real inspector:

```
copilot plugins list
```

It lists plugins, MCP servers and skills together with their scope.

## Authentication

The plugin's server carries no auth header, so it relies on the OAuth sign-in flow, the same as
Claude Code. The first tool call should open a browser to sign in to Foundry Connect.

**If your instance predates the OAuth build, or OAuth does not complete**, use a Personal Access
Token instead. Create one in Foundry Connect (your account, then Personal Access Tokens; it starts
with `via_mcp_`), then:

```
export FOUNDRY_MCP_PAT=via_mcp_...
copilot mcp add --transport http foundry-pat https://foundry.your-org.edu/mcp \
  --header 'X-Foundry-Connect-Token: ${FOUNDRY_MCP_PAT}'
```

Use **single quotes**. Copilot stores the `${...}` reference literally and expands it when it
connects, so the token itself never lands in `~/.copilot/mcp-config.json`.

Note the **different server name**. A user-added server named `foundry` is shadowed by the plugin's
own `foundry` and will not appear in `copilot mcp list` at all. Either pick a distinct name as above,
or uninstall the plugin if you want to manage the connection entirely by hand.

## Troubleshooting

**`copilot mcp list` shows no `Plugin servers` section.** The server entry was dropped during
validation and Copilot prints no error for this. The usual cause is a URL that is not absolute before
variables are expanded. Confirm you are on plugin version 0.2.0 or later (`copilot plugin list`);
0.1.1 shipped a URL with no scheme and is always dropped on this host.

**The install says `Installed 1 skill` but four appear.** That is expected. The count covers the
`skills/` directory only, while the three command wrappers are converted into skills as well. Check
with `copilot plugins list` rather than trusting the count.

**A command name clashes with another plugin.** The three converted commands arrive as bare
`foundry-results`, `foundry-run` and `foundry-status`, without the `foundry-connect:` prefix that
real skills get. Two plugins shipping the same command name collide, and only one survives.

**A deprecation warning on install.** Installing from a local path, a Git URL or a bare repository
prints a notice that only `plugin@marketplace` installs will be supported in future. The two commands
at the top of this guide are already the supported form.
