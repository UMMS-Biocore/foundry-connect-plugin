# Foundry Connect plugin

Foundry Connect is a bioinformatics pipeline platform: it authors processes and pipelines,
launches Nextflow runs on HPC schedulers and clouds, and serves the results. This plugin teaches
Claude to work with your Foundry Connect instance, so you can explore runs, read and analyze result
files, share results back, author processes, build or extend pipelines, and launch runs and apps in
conversation. Anything that writes or executes asks for your explicit yes first.

## Setup

Every Foundry Connect installation has its own address, so this plugin ships no server
configuration. Connect your instance once, then install the plugin.

1. Connect your Foundry Connect instance as an MCP connector named `foundry`. Use your instance's
   hostname in place of `foundry.your-org.edu`.

   - **Claude Code:** run
     `claude mcp add --transport http --scope user foundry https://foundry.your-org.edu/mcp`.
     Claude Code connects from your computer, so an instance on your campus network or VPN works.
   - **claude.ai, Claude Desktop and Cowork:** open Settings, then Connectors, choose Add custom
     connector, and enter `https://foundry.your-org.edu/mcp`. These apps connect from Anthropic's
     cloud, so the instance has to be reachable from the internet.

   Your instance's Connect to Claude page shows the exact connector URL.

2. Install this plugin from the directory, then restart Claude Code if you use it.
3. The first Foundry Connect tool call opens your browser to sign in (OAuth). There is no token to
   copy.
4. Ask "show my last 5 runs".

If you run Claude Code and want the server configured for you, install the `foundry-connect`
plugin from the [plugin repository's marketplace](https://github.com/UMMS-Biocore/foundry-connect-plugin)
instead. It asks for your hostname and builds the connector itself. Install one or the other, not
both.

## Skills

- **foundry-pipelines**: the main skill. It routes a request to the right workflow: explore and
  inspect runs, access and download result files, analyze data in chat, share results back,
  author or duplicate processes, execute a run, or launch an app.
- **foundry-pipeline-dev**: builds, extends, copies or rewires a pipeline. It designs the graph,
  creates the processes a step needs, builds and type checks the graph with the MCP pipeline
  tools, creates the pipeline, and starts a first test run.
- **foundry-kb**: answers a question about a project from a local clone of its knowledge base.
  It reads the brief, searches the raw sources and claims, gets every number and plot from a
  workspace job with a provenance block, and answers in labelled blocks with citations, or
  abstains when the evidence is missing.

## Commands

- **`/foundry-run`**: starts a run from a pipeline (or copies an existing run), fills its inputs,
  picks where it runs, and launches it, confirming each write.
- **`/foundry-status`**: shows a run's status and timings, and explains why it failed if it did.
- **`/foundry-results`**: lists a run's result files and reports, and loads the ones you ask for.
  Read only.

## What this plugin runs and sends

The plugin is skills and commands only. It declares no MCP server, runs nothing on your computer,
and sends nothing anywhere itself. Every tool call goes through the `foundry` connector you added
in step 1, to your own Foundry Connect instance and to nothing else. Sign in uses OAuth, and the
Claude app you use stores the result. The plugin never reads credentials from your computer.

## Safety

Read actions (listing runs, loading files, fetching reports) run freely. Anything that writes or
executes, such as creating a dataset, uploading a file, duplicating a process, or launching a run
or app, needs your explicit yes to a plain language summary before it is called.

## Links

- Documentation: <https://viafoundry.umassmed.edu/docs/developer-guides/using-viafoundry-with-claude/>
- Support: <https://viafoundry.umassmed.edu/docs/resources/contact-support/>
- Privacy policy: <https://viafoundry.umassmed.edu/docs/privacy-policy/>
- License: Apache-2.0
