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
`references/author.md`). The graph is built one of two ways, depending on the host:

- **With a shell** (Claude Code, Codex, Copilot CLI): the bundled `scripts/pipeline.py`, on top of
  the Foundry SDK. Setup is below.
- **Without a shell** (claude.ai, Claude Desktop): the Foundry Connect MCP pipeline tools. See
  "Without a shell" below. Wherever a step says `pipeline.py <command>`, use the matching tool.

## Before starting

1. **Pick the path once, up front.** If a shell with Python is available, use the script. If not,
   use the MCP pipeline tools.
2. **Run the script with the SDK**, without installing anything globally:
   `uv run --with git+https://github.com/UMMS-Biocore/foundry-sdk python <skill>/scripts/pipeline.py ...`
   (the SDK's `main` branch; the script stops with a clear message if that SDK has no pipeline
   support yet). Commands:

   | Command | Writes? | Does |
   | --- | --- | --- |
   | `revisions <pipeline id>` | no | every revision of a pipeline, each with its own id and version |
   | `process <process id>` | no | a process's input and output slots, with types and parameter ids |
   | `show <pipeline id>` | no | a saved pipeline as a spec you can edit |
   | `plan <spec.json>` | no | builds and type-checks the graph against the server |
   | `create <spec.json>` | yes | creates a new pipeline |
   | `update <pipeline id> <spec.json>` | yes | replaces an existing pipeline's graph |
3. **Sign-in:** the script uses the SDK's saved config. If it fails with an authentication error,
   ask the user to run `foundry configure` themselves and answer its prompts. Do not put a token or
   password in a command you run: command lines end up in shell history and in the transcript.

## Without a shell: the MCP pipeline tools

| Script command | MCP tool | Writes? |
| --- | --- | --- |
| `revisions <id>` | `list_pipeline_revisions(pipeline_id)` | no |
| `process <id>` | `get_process_details(process_id)`, `get_process_parameters(...)` | no |
| `show <id>` | `get_pipeline(pipeline_id)`: graph plus `connections` and `unconnected_inputs` | no |
| `plan <spec>` | `create_pipeline_config(name, pipeline_group_id, processes, connections, inputs, outputs, ...)` | no |
| `create <spec>` | `create_pipeline(...same arguments..., confirm_create=true)`, always new and private | yes |
| `update <id> <spec>` | `update_pipeline(pipeline_id, processes, connections, confirm_update=true, ...)` | yes |

The tools take **lists**, not the script's dicts. Translate the spec like this:

- `processes: {"check": 3017}` becomes `processes=[{"key": "check", "process_id": 3017}]`
- `inputs: {"label": {"name": "inputParam"}}` becomes `inputs=[{"key": "label", "name": "inputParam"}]`
- `outputs: {"report": {"name": "outputParam", "publish": "html"}}` becomes
  `outputs=[{"key": "report", "name": "outputParam", "publish": "html"}]`
- `edges` becomes `connections`, with the same `from`, `to`, `output` and `input` fields.

Pipeline 1777 in full: `processes=[{"key":"check","process_id":3017}]`,
`inputs=[{"key":"label","name":"inputParam"}]`, `outputs=[{"key":"report","name":"outputParam"}]`,
`connections=[{"from":"label","to":"check"},{"from":"check","to":"report"}]`.

Before a create, run `create_pipeline_config` and show the user its `connections` and
`unconnected_inputs`. Before an update, show `get_pipeline` for the current graph next to the new
`create_pipeline_config` result. Set `confirm_create` or `confirm_update` to true only after their
"yes". `update_pipeline` refuses a pipeline that is public, shared with a group, pinned, or not
editable by the signed in account; offer `create_pipeline` for a private copy instead.

**If one of these tools is missing** from the Foundry Connect connector, the server has not been
updated yet. Tell the user so, and stop at that step (they can wire the graph in the web editor:
Pipelines, New Pipeline, drag the processes in). Do not fall back to raw API calls.

## Safety (always apply)

- Reading is free: `revisions`, `process`, `show`, `plan`, their MCP equivalents, and the MCP list
  and get tools.
- **Each write needs its own "yes"** right before it, with a one-line summary of what changes:
  `pipeline.py create` or `create_pipeline`, `pipeline.py update` or `update_pipeline`, and every
  process write in `author.md`.
- **Save only over a pipeline the user owns and that no one else runs.** A save edits the pipeline
  in place (same id, same revision), so existing runs and other users see the change at once. To
  change anyone else's pipeline, or a shared or published one, `show` it, save the spec, and
  `create` a copy instead. The same goes for processes: duplicate, never edit someone else's.

## Workflow

### 1. Pin down the starting point and design the graph

**If the user names an existing pipeline, find the right revision first.** Every revision of a
pipeline has its own id, so a pipeline id the user remembers may be an older version: here,
pipeline 1545 is version 1.0.3 and its newer 1.0.4 is pipeline 1776, with a different analysis
process. Run `pipeline.py revisions <id>`, tell the user which versions exist, and confirm which
one to start from by name and version. Never assume the id they gave is the newest.


Write down the steps in order, what each consumes and produces (file type and whether it is one
file, a set per sample, or a value), which inputs a person fills in on the run page, and which
results should be published as reports. A short table is enough. Settle it before creating
anything; graph changes are cheap now and costly later.

### 2. Find or create a process for each step

- Reuse first: `list_all_processes` to find an existing step, then `pipeline.py process <id>` (or
  `get_process_details`) for its inputs and outputs in order; edges refer to these slots.
- Read each process's summary for what it needs at run time (a container, a GPU queue, memory).
  Note any step whose needs differ from the rest; step 5 sets them per process.
- If a step is missing, create it with the `author.md` tools. Traps found in real runs:
  - Reuse parameter definitions (`get_process_parameters`) so types line up across steps.
  - An output name is pasted verbatim into the generated Nextflow `output:` line. A file name like
    `report.txt` must be passed **with quotes**, `"\"report.txt\""`; unquoted it fails at run time
    with "Cannot get property 'txt' on null object".
  - `create_process_config` wraps `script_body` in the script block itself; pass plain shell.
- Process ids and pipeline ids are separate number spaces. Process 1545 is not pipeline 1545.

### 3. Write the spec and plan it

The ids below are examples; use the ones from your own instance.

```json
{
  "name": "Xenium analysis (my copy)",
  "pipeline_group_id": 667,
  "summary": "One line on what it does and who it is for.",
  "processes": {"download": 2357, "analysis": 2356},
  "inputs":    {"samplesheet": {}, "metadatasheet": {}},
  "outputs":   {"HTML_Report": {"publish": "html"}, "Analysis_Results_RDS": {"publish": "rdata"}},
  "edges": [
    {"from": "samplesheet",   "to": "download"},
    {"from": "download",      "to": "analysis", "input": "inputDir"},
    {"from": "metadatasheet", "to": "analysis", "input": 2},
    {"from": "metadatasheet", "to": "analysis", "input": "metadatasheet"},
    {"from": "analysis", "output": "outputHTML", "to": "HTML_Report"},
    {"from": "analysis", "output": 0,            "to": "Analysis_Results_RDS"}
  ]
}
```

- Keys under `processes`, `inputs` and `outputs` are your labels; edges use them, and each becomes
  that node's name in the editor. An input's label is its field name on the run page (override an
  input or output name with `{"name": "..."}`).
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
- `show` lists an input's edges with the one that set its parameter id first, so they may not be in
  the order the editor saved them. That is deliberate; keep that edge first when you edit.
- To extend an existing pipeline, start from `pipeline.py show <id> > spec.json` and edit that.

Run `pipeline.py plan spec.json`. It reads each process from the server and refuses an edge whose
ends differ in file type, a slot that is ambiguous or already taken, or an edge in the wrong
direction. Fix the spec until it plans, then show the user the printed graph.

### 4. Create the pipeline

After a "yes", `pipeline.py create spec.json`. It is private unless the spec sets `"permission"`.
Report the new pipeline id and check it with `pipeline.py show <new id>`; it should read back as
your spec. Suggest the user open it once in the web editor to tidy the layout, since the script
places nodes in simple columns.

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

Change processes by revising them (or a duplicate), and change the graph by editing the spec and
running `pipeline.py update <id> spec.json` after a "yes", only under the ownership rule above.
`update` replaces the whole graph with the spec's, so start from a fresh `show`, not from memory.

## When something will not plan or looks wrong

Read `references/graph-format.md`: node and edge string format, the type rule, and why one pipeline
input can feed several steps.
