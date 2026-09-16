# Connect: Codex CLI

Codex takes this repository as a plugin marketplace and installs the skill and command wrappers from
it. **The connection itself is added separately**, with one command, because Codex cannot resolve a
per-customer address out of a bundled plugin.

Measured against `codex-cli 0.153.0`. The OAuth commands were checked against `codex-cli 0.154.0`.

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

## Check your instance supports OAuth

Codex finds the sign-in endpoints by building the **path-suffixed** discovery URL itself, and it
never falls back to the plain one. Check that your instance answers it with JSON:

```
curl -s https://foundry.your-org.edu/.well-known/oauth-protected-resource/mcp
```

A reply like `{"resource":"https://foundry.your-org.edu/mcp","authorization_servers":[...]}` means
OAuth works and you can follow the next section as written. If you get an HTML page or a 404, the
instance predates that fix: skip to [Personal Access Token instead](#personal-access-token-instead).

## Add the connection and sign in

Codex stores a bundled server's URL **exactly as written** and never expands variables in it, so the
plugin's own entry cannot point at your instance. Add the real one yourself:

```
codex mcp add foundry --url https://foundry.your-org.edu/mcp
```

Use your own hostname, keep the `/mcp` on the end, and keep the name `foundry`. A server you add
this way **takes precedence over the plugin's unusable entry of the same name**, so the plugin's
placeholder disappears from the list once yours exists.

**This one command also signs you in.** Codex sees that the server supports OAuth, prints
`Detected OAuth support. Starting OAuth flow`, and opens your browser:

1. Sign in to Foundry Connect if you are not already.
2. On the **Connect to Foundry Connect** page, click **Approve**.
3. The browser is then sent to `http://127.0.0.1:<port>/callback`. That address is **Codex itself**,
   listening on your own machine for the sign-in result. It is expected, not a misconfiguration.
4. Go back to the terminal. Codex reports that the login succeeded.

**Use your default browser.** Run `codex mcp add` in your system terminal rather than inside the
Codex app, which can open the sign-in in its own built-in browser. Codex also prints
``Authorize `foundry` by opening this URL in your browser:`` with the link, so you can paste it into
your default browser yourself. If an assistant runs the command for you, it should show that link
as a clickable link and open it with `open` (macOS), `xdg-open` (Linux) or `start` (Windows); see
[`INSTALL.md`](../INSTALL.md).

The callback tab sometimes shows "This site can't be reached". Codex stops listening the moment it
receives the result, so if the tab loads the address a second time (a reload, a retry, or the
browser preloading it) there is nothing left to answer. If the terminal says the login succeeded,
the tab can be closed and ignored.

**Do not run `codex mcp login foundry` straight after `codex mcp add`.** The add already signed you
in, so a second login sends you through Approve again and registers a second, redundant connection.

Confirm:

```
codex mcp list
```

The `Url` column must show your real hostname. If it still shows `https://${instance_host}/mcp`, the
manual add did not happen and nothing will connect. The `Auth` column should show OAuth.

### Codex and the browser must be on the same machine

The callback goes to `127.0.0.1`, which is whichever machine the **browser** runs on. If Codex runs
somewhere else, for example over SSH or inside a remote dev container, the browser cannot reach it
and the sign-in never completes. Run the sign-in on the machine with the browser, or use a
Personal Access Token on the remote machine.

## Signing in again

Use these later, not as part of the first setup:

```
codex mcp login foundry    # sign in again, e.g. after the connection was revoked or expired
codex mcp logout foundry   # remove the stored sign-in from this machine
```

If a Foundry Connect tool call fails with `Authentication required`, run `codex mcp login foundry`.

## Personal Access Token instead

Use this on an instance that predates the OAuth build, or where Codex cannot open a browser on the
same machine. Create a token in Foundry Connect (your account, then Personal Access Tokens; it starts
with `via_mcp_`). Export it, then add the server so it reads the variable by name rather than storing
the secret:

```
export FOUNDRY_MCP_PAT=via_mcp_...
codex mcp add foundry --url https://foundry.your-org.edu/mcp --bearer-token-env-var FOUNDRY_MCP_PAT
```

Codex sends it as `Authorization: Bearer <token>`, which Foundry Connect accepts alongside the
`X-Foundry-Connect-Token` header. Put the `export` in your shell profile so new terminals have it.

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
