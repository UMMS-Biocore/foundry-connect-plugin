# Author & duplicate processes

Purpose: create or duplicate individual **processes** (pipeline steps) and their parameters.

**Not available yet:** there is no tool for authoring a full multi-step pipeline recipe from
scratch (wiring several processes together into a complete pipeline graph). If a user asks to
"build a whole new pipeline," say plainly that step-level process authoring is supported today but
end-to-end pipeline-recipe authoring is not, and offer the process-level tools below instead (or
point to duplicating/launching an existing pipeline via `execute.md`).

## Read tools (free, no confirmation)

| Tool | Usage |
| --- | --- |
| `list_all_processes()` | List every process/pipeline in Foundry Connect — ID, name, summary, owner. |
| `get_process_details(process_id)` | Full configuration for one process: scripts, parameters, metadata. |
| `get_process_revisions(process_id)` | Version history for a process. |
| `list_process_parameters()` | List all parameter definitions available system-wide (name, type, constraints) — check here before creating a new one. |
| `get_process_parameters(name, qualifier, file_type, id)` | Filter parameter definitions by name/qualifier/file type/ID. (`file_type` is this tool's own snake_case argument — not the same namespace as the `fileType` JSON field below.) |

## Write tools (confirm before each call)

| Tool | Usage |
| --- | --- |
| `duplicate_process(process_id)` | Clone an existing process so it can be modified independently of the original. |
| `create_process_config(name, menu_group_name, script_body, input_params, output_params, summary, script_language, permission_settings, revision_comment)` | Build a complete process definition, ready to pass into `create_process`. `input_params`/`output_params` reference existing parameters by `name` + `qualifier` + `fileType` — look them up with `list_process_parameters`/`get_process_parameters` first. If no existing parameter matches, this call **creates a new one automatically**, so treat it as a write even though it "just" builds a config. `menu_group_name` must name an existing menu group. |
| `create_process(process_data)` | Register a new process/pipeline step in Foundry Connect. `process_data` is normally the output of `create_process_config`. |
| `create_process_parameter(parameter_data)` | Define a brand-new reusable parameter. Only do this when `list_process_parameters`/`get_process_parameters` show nothing suitable to reuse. |

## Worked examples

**"Duplicate the FastQC process so I can tweak it"**
→ confirm: *"I'll clone the FastQC process into a new copy you can edit — proceed?"*
→ `duplicate_process(process_id="<fastqc id>")` → returns the new process's ID.
→ optionally `get_process_details(process_id="<new id>")` to review the copy before further edits.

**"Create a new process for trimming adapters"**
→ `list_process_parameters()` / `get_process_parameters(...)` to find reusable parameter
definitions for inputs/outputs (e.g. an existing `reads`/fastq parameter).
→ confirm: *"I'll build a process config named `<name>` using the script below — proceed?"*
(state the script/summary being used)
→ `create_process_config(name="<name>", menu_group_name="<existing group>", script_body="<script>", input_params=[...], output_params=[...])`
→ confirm: *"I'll register that config as a new process named `<name>` — proceed?"*
→ `create_process(process_data=<output of the previous call>)`

As with `share-back.md`, each write gets its own confirmation immediately before it —
`create_process_config` and `create_process` are two separate writes and each needs its own "yes,"
even though both were described in the original request. If the plan changes (e.g. a needed
parameter doesn't exist and must be created via `create_process_parameter`), stop and confirm that
additional write too.
