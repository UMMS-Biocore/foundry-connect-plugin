---
name: foundry-pipelines
description: Use when a user wants to work with ViaFoundry from Claude — explore or inspect runs, access/download result files, analyze data in chat, share results back, author or duplicate pipelines/processes, execute (launch) a run, or launch an app. Routes to task-specific references and enforces confirm-before-write safety.
---

# ViaFoundry pipelines

Drive the ViaFoundry lifecycle through the `foundry` MCP server's tools. Works on every Claude
surface (claude.ai / Claude for Science, Desktop, Claude Code) — all actions are MCP tool calls.

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
