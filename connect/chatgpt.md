# Connect: ChatGPT web

> **Status: no self-serve path today.** This page explains why, and what the options are, so nobody
> spends an afternoon looking for a button that does not exist.

## Why the ordinary routes do not apply

ChatGPT does not read a local config file the way the CLIs do, so there is nowhere for you to type
your instance URL. Plugins reach it two ways, and neither is self-serve for a per-customer
deployment:

- **The public plugin directory** expects one fixed URL that works for everyone. Per-customer
  template URLs do exist, but they are granted only to developers with an established relationship
  with OpenAI, and submission carries review obligations on every update. The blockers here are
  commercial and procedural rather than technical.
- **A registered connection** is declared in a plugin's `.app.json` as an opaque identifier that
  looks like `connector_<hex>`. That identifier is provisioned on OpenAI's side. A plugin cannot
  point one at a customer's own host without OpenAI registering that connector first, so this route
  needs the same relationship the directory does.

## What a workspace administrator can do

ChatGPT workspace administrators can import and sync a GitHub marketplace privately for their team,
which needs no directory submission at all and fits a single-organization deployment well.

The catch is the address. This plugin declares its server as `https://${instance_host}/mcp`, and
OpenAI hosts store a bundled server's URL **exactly as written** without expanding variables. So an
imported copy would carry an unusable placeholder.

The workaround, **untested**, is to fork this repository and replace the templated URL with your own
hostname before importing:

```json
{
  "mcpServers": {
    "foundry": {
      "url": "https://foundry.your-org.edu/mcp"
    }
  }
}
```

in `plugins/foundry-connect/.mcp.json`. One fork per organization, which is exactly the tradeoff the
templating was meant to avoid, but it is contained when the importing workspace and the Foundry
Connect instance belong to the same organization anyway.

If you try this, please report what happens so this page can stop saying "untested".

## What to use instead today

For a verified path on OpenAI tooling, use the [Codex CLI guide](codex-cli.md). For the smoothest
experience overall, [Claude Code](claude-code.md) and [Copilot CLI](copilot-cli.md) are both fully
supported.
