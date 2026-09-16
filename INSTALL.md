# Install Foundry Connect

Short on purpose, so an assistant can follow it too. Replace `HOST` with the Foundry Connect
hostname only, for example `foundry.your-org.edu`: no `https://`, no trailing slash, no `/mcp`.

**Assistants:** ask the user for `HOST` if you do not have it. Run the block for the app you are
running in. If your sandbox blocks a command, or the command needs a browser, give the user the
exact command to run in their own terminal. Never ask the user to paste a token into the chat.

## 1. Check the instance

```
curl -s https://HOST/.well-known/oauth-protected-resource/mcp
```

JSON back: OAuth works, continue. HTML or a 404: the instance is too old for OAuth, so use a
Personal Access Token as shown in that app's guide under [`connect/`](connect/).

## 2. Install

**Claude Code** (terminal)

```
claude plugin marketplace add UMMS-Biocore/foundry-connect-plugin
claude plugin install foundry-connect@foundry-connect --config instance_host=HOST
```

**Codex CLI and Codex IDE extension** (terminal)

```
codex plugin marketplace add UMMS-Biocore/foundry-connect-plugin
codex plugin add foundry-connect@foundry-connect
codex mcp add foundry --url https://HOST/mcp
```

The last command signs in by itself. Do not run `codex mcp login` afterwards.

**Sign in with the default browser, not the Codex app's built-in one.** The sign-in only needs your
normal browser and this machine:

- **Assistants running inside the Codex app:** run `codex mcp add` with a long timeout (5 minutes)
  and keep it running, because it is waiting for the sign-in. It prints
  ``Authorize `foundry` by opening this URL in your browser:`` followed by a URL. Show that URL to
  the user as a clickable Markdown link, `[Sign in to Foundry Connect](<url>)`, and also open it in
  the default browser with `open "<url>"` (macOS), `xdg-open "<url>"` (Linux) or
  `start "" "<url>"` (Windows). Tell the user: approve in the browser, then close that tab; there is
  no need to come back to it. Wait for `Successfully logged in to MCP server 'foundry'`. If your
  sandbox cannot run it or it times out, give the user the command to run in their system terminal
  (Terminal, iTerm, PowerShell), which opens the default browser on its own.
- **Doing it yourself:** run the command in your system terminal, not inside the Codex app. If a
  built-in browser opens anyway, copy the printed URL into your default browser.

After **Approve**, the browser briefly goes to `http://127.0.0.1:<port>/callback`. Codex answers
with "Authentication complete. You may close this window." If the tab shows "can't be reached"
instead, the sign-in still worked when the terminal says it succeeded. Close the tab either way.

**Copilot CLI** (terminal)

```
copilot plugin marketplace add UMMS-Biocore/foundry-connect-plugin
copilot plugin install foundry-connect@foundry-connect
echo 'export instance_host=HOST' >> ~/.zshrc   # or ~/.bashrc
```

**claude.ai, Claude for Science, Claude Desktop** (no terminal): Settings, Connectors, add a custom
connector with the URL `https://HOST/mcp`, then click Connect.

## 3. Sign in and restart

- A browser opens (Codex: during `codex mcp add`; Claude Code and Copilot: on the first Foundry
  Connect tool call). Sign in and click **Approve**.
- The browser then goes to a `http://127.0.0.1:<port>/...` or `http://localhost:<port>/...` page.
  That is the app on your machine receiving the result. If that tab says the site can't be reached
  but the app reports success, you are signed in. The browser and the app must be on the same
  machine.
- **Start a new session** of the app (for Copilot, in a new terminal). MCP servers load at session
  start.

## 4. Verify

| App | Command | Expect |
| --- | --- | --- |
| Claude Code | `claude mcp list` | `foundry` connected |
| Codex | `codex mcp list` | `foundry`, your `HOST` in `Url`, `OAuth` in `Auth` |
| Copilot CLI | `copilot mcp list` | `foundry (http)` under `Plugin servers` |

Then ask: **"show my last 5 runs"**.

Problems, tokens, and per-app details: [`connect/`](connect/).
