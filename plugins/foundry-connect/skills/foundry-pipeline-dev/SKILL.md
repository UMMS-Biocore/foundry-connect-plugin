---
name: foundry-pipeline-dev
description: Use when a user wants to build, extend, copy or rewire a Foundry Connect pipeline: wiring processes into a multi-step pipeline, adding a step to an existing pipeline, making their own copy of a pipeline to change it, creating a new process for a pipeline step, or test-running a pipeline they are developing. Use it even when they say "workflow" or "add a step" instead of "pipeline", or ask to "build a pipeline from these scripts". Covers designing the graph, creating processes, building and type-checking the graph from a JSON spec, creating the pipeline, and a first test run, with confirm-before-write safety.
---

# Foundry Connect pipeline development

A Foundry Connect pipeline is a graph: **process** nodes (one step each), pipeline **input** nodes
(the fields people fill in on the run page) and pipeline **output** nodes (published results and
reports), joined by typed edges. This skill takes a user from "I have these steps" to a pipeline
that runs.

Processes are authored through the Foundry Connect MCP tools (see the `foundry-pipelines` skill,
`references/author.md`). The graph is built with the Foundry Connect MCP pipeline tools, on every
host. They sign in through the connector, so nothing is installed and no credential is read from
the user's machine.

## The pipeline tools

| Step | MCP tool | Writes? |
| --- | --- | --- |
| revisions | `list_pipeline_revisions(pipeline_id)`: every revision, each with its own id and version | no |
| process slots | `get_process_details(process_id)`, `get_process_parameters(...)`: inputs and outputs in order | no |
| show | `get_pipeline(pipeline_id)`: graph plus `connections` and `unconnected_inputs` | no |
| plan | `create_pipeline_config(name, pipeline_group_id, processes, connections, inputs, outputs, ...)`: builds and type-checks the graph | no |
| create | `create_pipeline(...same arguments..., confirm_create=true)`, always new and private | yes |
| update | `update_pipeline(pipeline_id, processes, connections, confirm_update=true, ...)`: replaces the graph | yes |

Before a create, run `create_pipeline_config` and show the user its `connections` and
`unconnected_inputs`. Before an update, show `get_pipeline` for the current graph next to the new
`create_pipeline_config` result. Set `confirm_create` or `confirm_update` to true only after their
"yes". `update_pipeline` refuses a pipeline that is public, shared with a group, pinned, or not
editable by the signed in account; offer `create_pipeline` for a private copy instead.

**If one of these tools is missing** from the Foundry Connect connector, the server has not been
updated yet. Tell the user so, and stop at that step (they can wire the graph in the web editor:
Pipelines, New Pipeline, drag the processes in). Do not fall back to raw API calls.

Never ask the user for a token or password, and never put one in a command: sign in is the
connector's job.

## Safety (always apply)

- Reading is free: the revisions, process, show and plan tools, and the MCP list and get tools.
- **Each write needs its own "yes"** right before it, with a one-line summary of what changes:
  `create_pipeline`, `update_pipeline`, and every process write in `author.md`.
- **Save only over a pipeline the user owns and that no one else runs.** A save edits the pipeline
  in place (same id, same revision), so existing runs and other users see the change at once. To
  change anyone else's pipeline, or a shared or published one, read it with `get_pipeline` and
  `create_pipeline` a copy instead. The same goes for processes: duplicate, never edit someone
  else's.

## Workflow

### 1. Pin down the starting point and design the graph

**If the user names an existing pipeline, find the right revision first.** Every revision of a
pipeline has its own id, so a pipeline id the user remembers may be an older version: here,
pipeline 1545 is version 1.0.3 and its newer 1.0.4 is pipeline 1776, with a different analysis
process. Run `list_pipeline_revisions`, tell the user which versions exist, and confirm which one
to start from by name and version. Never assume the id they gave is the newest.

Write down the steps in order, what each consumes and produces (file type and whether it is one
file, a set per sample, or a value), which inputs a person fills in on the run page, and which
results should be published as reports. A short table is enough. Settle it before creating
anything; graph changes are cheap now and costly later.

### 2. Find or create a process for each step

- Reuse first: `list_all_processes` to find an existing step, then `get_process_details` for its
  inputs and outputs in order; connections refer to these slots.
- Read each process's summary for what it needs at run time (a container, a GPU queue, memory).
  Note any step whose needs differ from the rest; step 5 sets them per process.
- If a step is missing, create it with the `author.md` tools. Traps found in real runs:
  - Reuse parameter definitions (`get_process_parameters`) so types line up across steps.
  - An output name is pasted verbatim into the generated Nextflow `output:` line. A file name like
    `report.txt` must be passed **with quotes**, `"\"report.txt\""`; unquoted it fails at run time
    with "Cannot get property 'txt' on null object".
  - `create_process_config` wraps `script_body` in the script block itself; pass plain shell.
- Process ids and pipeline ids are separate number spaces. Process 1545 is not pipeline 1545.

### 3. Write the graph and plan it

The ids below are examples; use the ones from your own instance.

```json
{
  "name": "Xenium analysis (my copy)",
  "pipeline_group_id": 667,
  "summary": "One line on what it does and who it is for.",
  "processes": [{"key": "download", "process_id": 2357}, {"key": "analysis", "process_id": 2356}],
  "inputs":    [{"key": "samplesheet"}, {"key": "metadatasheet"}],
  "outputs":   [{"key": "HTML_Report", "publish": "html"}, {"key": "Analysis_Results_RDS", "publish": "rdata"}],
  "connections": [
    {"from": "samplesheet",   "to": "download"},
    {"from": "download",      "to": "analysis", "input": "inputDir"},
    {"from": "metadatasheet", "to": "analysis", "input": 2},
    {"from": "metadatasheet", "to": "analysis", "input": "metadatasheet"},
    {"from": "analysis", "output": "outputHTML", "to": "HTML_Report"},
    {"from": "analysis", "output": 0,            "to": "Analysis_Results_RDS"}
  ]
}
```

These are the arguments to `create_pipeline_config`, and later to `create_pipeline`.

- Each `key` under `processes`, `inputs` and `outputs` is your label; connections use it, and it
  becomes that node's name in the editor. An input's key is its field name on the run page
  (override an input or output name with `"name": "..."`).
- `input` / `output` pick a process slot by index, name, sname or parameter id. Leave them out when
  the process has only one.
- Every output node's file is saved to the run's published results whether or not it has
  `publish`. `publish` additionally shows it in the run's report view. Values seen on real
  pipelines: `html`, `table`, `table-percent`, `text`, `pdf`, `image`, `rdata`, `apps`,
  `ucsc_genome_browser`, and comma-joined combinations such as `"apps,table"`. Leave it out for a
  file people only download.
- `pipeline_group_id` is a **pipeline** menu group (where it sits in the Pipelines menu), not a
  process menu group. Propose the source pipeline's group when copying, and ask the user to
  confirm it or name another, since it decides where others find the pipeline.
- `get_pipeline` lists an input's connections with the one that set its parameter id first, so
  they may not be in the order the editor saved them. That is deliberate; keep that connection
  first when you edit.
- To extend an existing pipeline, start from its `get_pipeline` graph and edit that.

Run `create_pipeline_config`. It reads each process from the server and refuses a connection whose
ends differ in file type, a slot that is ambiguous or already taken, or a connection in the wrong
direction. Fix the graph until it plans, then show the user the result.

### 4. Create the pipeline

After a "yes", `create_pipeline` with the same arguments and `confirm_create=true`. It is private.
Report the new pipeline id and check it with `get_pipeline`; it should read back as your graph.
Suggest the user open it once in the web editor to tidy the layout, since nodes are placed in
simple columns.

### 5. Test-run it

Start a run from the new pipeline with the `foundry-pipelines` skill's `references/execute.md`
(each write confirmed). Two things the run tools cannot set today, so tell the user to set them on
the run page under advanced settings before launching: container use (Singularity or Docker on or
off) and the executor settings (queue, memory, CPUs, time). A new run may start with the container
switched on even when the process has no image. When steps need different settings (one on a GPU
queue, the rest on the default), set the common ones under the settings for all processes and
override the odd step in its own per-process executor settings.

When a run fails, read its log (`get_run_log`) before changing anything. A failure at once with a
Groovy error usually means an unquoted output name (step 2).

### 6. Iterate

Change processes by revising them (or a duplicate), and change the graph by editing it and running
`update_pipeline` after a "yes", only under the ownership rule above. `update_pipeline` replaces
the whole graph, so start from a fresh `get_pipeline`, not from memory.

## When something will not plan or looks wrong

Read `references/graph-format.md`: node and edge string format, the type rule, and why one pipeline
input can feed several steps.
