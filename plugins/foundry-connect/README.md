# Foundry Connect plugin

Foundry Connect is a bioinformatics pipeline platform: it authors processes and pipelines,
launches Nextflow runs on HPC schedulers and clouds, and serves the results. This plugin connects
Claude to your Foundry Connect instance through its remote MCP server, so you can explore runs,
read and analyze result files, share results back, author processes, build or extend pipelines,
and launch runs and apps in conversation. Anything that writes or executes asks for your explicit
yes first.

## Setup

1. Add the marketplace and install the plugin, giving your instance **hostname only** (no
   `https://`, no trailing slash, no `/mcp`):

   ```
   claude plugin marketplace add UMMS-Biocore/foundry-connect-plugin
   claude plugin install foundry-connect@foundry-connect --config instance_host=foundry.your-org.edu
   ```

   Installing from inside a session with `/plugin install` prompts for the hostname instead.

2. Restart Claude Code. Plugin MCP servers load at session start.
3. Run `/mcp` and look for the `foundry` server. The first Foundry Connect tool call opens your
   browser to sign in (OAuth). There is no token to copy.
4. Ask "show my last 5 runs".

Other assistants (Copilot CLI, Codex, claude.ai, Claude Desktop) have their own guides in the
[`connect/`](https://github.com/UMMS-Biocore/foundry-connect-plugin/tree/main/connect) folder of
this repository.

## Skills

- **foundry-pipelines**: the main skill. It routes a request to the right workflow: explore and
  inspect runs, access and download result files, analyze data in chat, share results back,
  author or duplicate processes, execute a run, or launch an app.
- **foundry-pipeline-dev**: builds, extends, copies or rewires a pipeline. It designs the graph,
  creates the processes a step needs, builds and type checks the graph from a JSON spec, creates
  the pipeline, and starts a first test run.

## Commands

- **`/foundry-run`**: starts a run from a pipeline (or copies an existing run), fills its inputs,
  picks where it runs, and launches it, confirming each write.
- **`/foundry-status`**: shows a run's status and timings, and explains why it failed if it did.
- **`/foundry-results`**: lists a run's result files and reports, and loads the ones you ask for.
  Read only.
- **`/foundry-channel-login`**: signs the chat channel in again, for example after its sign in
  expired.

## What this plugin runs and sends

The plugin declares two MCP servers.

**`foundry`** is a remote HTTP connection to `https://<your hostname>/mcp`. Every tool call goes
to your own Foundry Connect instance and to nothing else. Sign in uses OAuth, and Claude Code
stores the result.

**`foundry-channel`** (shown as "Foundry Connect chat") is a local channel that links this Claude
Code session to the chat drawer in the Foundry Connect web app, so you can talk to the session
from the browser. Specifically:

- Claude Code starts it as a **Node.js process** on your machine, running the bundled
  `channel/dist/channel.js`. Node 18 or later is required, and nothing is downloaded or installed
  at run time.
- It opens a **socket connection** (Socket.IO over HTTPS) to your Foundry Connect instance, to the
  same hostname you configured. It does not contact any other host.
- On connect it sends a session descriptor: a random session id, your machine's hostname, the
  folder Claude Code was started in, the start time, and the channel version. After that it
  carries messages you send from the drawer into this session, Claude's replies back to the
  drawer, and tool permission prompts you choose to answer from the drawer.
- On first start it opens your browser once to sign in. The resulting **sign in is stored** in
  `~/.config/foundry-connect/channel.json` (or under `$XDG_CONFIG_HOME`). It is never printed,
  logged or sent to Claude, and it works only against the instance it was issued for.
- **`/foundry-channel-login`** runs `node channel/dist/channel.js login` to sign in again. It prints
  status lines only. The running channel picks up the new sign in within a few seconds.

If no hostname is configured, the channel stays idle and connects to nothing. Disable it from
`/mcp` if you do not use the chat drawer; the `foundry` tools keep working without it.

The plugin on the Claude web and desktop apps (claude.ai, Cowork) delivers the skills only. Those
surfaces connect Foundry Connect as a separate MCP connector; see the `connect/` guides.

## Safety

Read actions (listing runs, loading files, fetching reports) run freely. Anything that writes or
executes, such as creating a dataset, uploading a file, duplicating a process, or launching a run
or app, needs your explicit yes to a plain language summary before it is called.

## Links

- Documentation: <https://viafoundry.umassmed.edu/docs/developer-guides/using-viafoundry-with-claude/>
- Support: <https://viafoundry.umassmed.edu/docs/resources/contact-support/>
- Privacy policy: <https://viafoundry.umassmed.edu/docs/privacy-policy/>
- License: Apache-2.0
