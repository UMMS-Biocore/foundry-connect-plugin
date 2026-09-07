---
name: foundry-pipelines
description: Use when a user wants to work with Foundry Connect: explore or inspect runs, access/download result files, analyze data in chat, share results back, author or duplicate pipelines/processes, execute (launch) a run, or launch an app. Routes to task-specific references and enforces confirm-before-write safety.
---

# Foundry Connect pipelines

Drive the Foundry Connect lifecycle through the `foundry` MCP server's tools. All actions are MCP
tool calls, so this works on every supported host: Claude Code, claude.ai and Claude for Science,
Claude Desktop, GitHub Copilot CLI, and Codex.

**If the `foundry` tools are not available**, the MCP server is not connected on this host. Do not
try to work around it. Tell the user to check the connect guide for their surface in the
[plugin repository](https://github.com/UMMS-Biocore/foundry-connect-plugin) under `connect/`, and
note the two most common causes: the session was not restarted after installing, and on Copilot the
`instance_host` environment variable is not set.

## Safety model (always apply)
- **Read/inspect tools are free** (list/get/download/load/report paths).
- **Write or execute tools require an explicit, per-action "yes"** with a one-line plain-language
  summary of exactly what will change, BEFORE the call. This covers: `create_vmeta_dataset`,
  `add_files_to_dataset`, `upload_file`, `create_collection`, `create_process*`, `duplicate_process`,
  `duplicate_run`, `update_run`, `initiate_run`, `launch_app`. Never chain writes without a yes each.

## Route to the right reference (read on demand)
| The user wants to… | Read |
| --- | --- |
| List/inspect runs, download or load result files, find report paths | `references/explore-access.md` |
| Analyze already-loaded data in chat | `references/analyze.md` |
| Upload results, add files to a dataset, create a collection | `references/share-back.md` |
| Create/duplicate a process, set parameters/config | `references/author.md` |
| Duplicate → edit inputs → launch (execute) a run, then monitor | `references/execute.md` |
| List/launch an app and return its link | `references/apps.md` |

If unsure which, ask one clarifying question, then open the matching reference.
