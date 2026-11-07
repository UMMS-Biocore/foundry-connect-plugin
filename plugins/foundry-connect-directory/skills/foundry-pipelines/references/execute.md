# Execute (launch) a run

Purpose: start a run of a pipeline, fill its inputs, choose where it runs, launch it, and monitor
progress. There are two paths:

- **A. New run from a pipeline (default).** Works for anyone who can read the pipeline, with no
  earlier run needed: choose or create a project, choose the pipeline, create the run, fill the
  form, choose a run environment and execution directory, preflight, launch.
- **B. Copy an existing run.** Duplicate a working run and edit it. Use this when the user names a
  run to copy, or wants a known good configuration.

This is the highest-stakes flow in the skill: it ends in **launching compute**. Per the skill's
safety model, every write and the execute call each get their own explicit, per-action "yes" with
a one-line plain-language summary *before* the call. Never chain writes or the execute on a single
earlier "yes", even when the whole flow was described in one request.

Most tools below hit endpoints under `/api/v1/run/...`; projects live under `/api/v1/project/`,
pipelines under `/api/v1/pipeline/`, and `create_vmeta_dataset`/`add_files_to_dataset` under
`/api/v1/vmeta/...`.

## Tools

| Tool | Read/Write | Usage |
| --- | --- | --- |
| `list_projects(name, limit)` | Read | Projects you own. Pick the one the run goes in. |
| `create_project(name, summary)` | **Write: confirm** | A new private project, when none fits. |
| `list_pipelines(search, limit)` | Read | Every pipeline you can read (released, public, yours, shared with your groups). `list_featured_pipelines` / `recommend_pipeline` are the curated views. |
| `create_run(pipeline_id, project_id, name)` | **Write: confirm** | Path A. Creates an unlaunched run and returns its **form**: `run_id`, `inputs`, `process_options`, `permission`, `groupId`, the `run_environments` you can launch on, and `proposed_execution_directory` (one per environment id; `null` means none could be proposed). Nothing is launched. |
| `list_run_environments(run_id)` | Read | The same environments and proposed directories for an existing run. |
| `get_run_details(run_id, verbose=True)` | Read | Path B. **`verbose=True` is required.** Without it the tool returns a compact human summary; only `verbose=True` returns `inputs[]`, `processOptions{}`, `permission`, `groupId`, `mainPipeline` (`.id` = pipeline_id) and `project` (`.id` = project_id). Call it on the **source** run first. |
| `duplicate_run(run_id, project_id, pipeline_id)` | **Write: confirm** | Path B. Clones the source run. Returns the new run's id as **`duplicatedRunId`**. |
| `create_vmeta_dataset(name)` | **Write: confirm** | Only if new data needs a fresh dataset. `name` must be non-empty and unique in the project. Returns the dataset's `_id`. |
| `add_files_to_dataset(dataset_id, file_data)` | **Write: confirm** | Only if new data needs a fresh dataset. `file_data` needs `canvasId` and `file` (e.g. `{"name": ..., "path": ...}`). One call per file, each confirmed separately. |
| `update_run(run_id, inputs=None, process_options=None, permission, group_id=None, run_environment_id=None, launch_directory=None, publish_dir=None, name=None)` | **Write: confirm** | Saves the run before launch. Sends only the fields you give. See Gotchas: this is the step most likely to be rejected by validation. |
| `preflight_run(run_id)` | Read | Checks the run before launch: run environment and execution directory set, no empty inputs, sample sheet and dataset consistent. Fix every `fail` before launching. |
| `initiate_run(run_id, run_type="newrun")` | **Execute: confirm** | Starts compute. `run_type` is `newrun` (fresh), `resumerun` (Nextflow `-resume`), or `rerun` (new attempt, same params). Returns `status`, `runUUID`, `localRunDir`. The point of no return: confirm explicitly, separately from `update_run`. |
| `get_run(run_id)` / `watch_run(run_id)` | Read | Poll after `initiate_run`. `status_display` reads "Running", "Completed", "Failed". |
| `get_run_log(run_id, attempt_id=None)` | Read | **Use this when a run failed.** Returns the tail of the most relevant log plus a summary. |

## Gotchas (exact rules: validation fails without these)

- **A new run cannot launch until a run environment and an execution directory are saved.**
  `create_run` leaves both empty. Set them with `update_run(run_environment_id=...,
  launch_directory=...)`; `preflight_run` names whichever is missing.
- **Always show the proposed execution directory before saving it.** It is the run environment's
  declared default when it has one, otherwise `/home/<login>/foundry-connect-runs/<run name>`
  using the environment's own login name. When it is `null` (for example a cloud environment with
  no login name), ask the user for an absolute path. Never save a directory the user has not seen.
- **Only your own run environments are offered.** If `run_environments` is empty, the user has
  none they can launch on: tell them to add one under their profile's run environments, or ask
  their organization to share one. Do not try another user's environment.
- **`process_options` replaces the whole set.** Leave it out when only setting the environment or
  directory. When you do send it, send it complete (from the form or `get_run_details(...,
  verbose=True)`), never rebuilt from the compact summary.
- **No empty-string input values.** No `inputs[]` entry's `value` may be `""`. Use `"NA"`, or omit
  the input.
- **`permission` is required on every `update_run`; `group_id` is conditionally required.** Echo
  `permission` from the form (path A) or the source run (path B). Pass `group_id` only when
  `permission == 15` (GroupShared).
- **Equal-length spreadsheet columns.** Within one `processOptions` entry, every list-typed column
  must be the same length.
- **Path B: `duplicate_run` can silently drop data.** The duplicate may drop the vmetaCollection
  input (e.g. `reads`) and copy `processOptions` with empty arrays. Path-type inputs are copied
  verbatim and may point at the source project's paths. It also keeps the **source run's run
  environment**, which you may not be allowed to launch on: check `list_run_environments` and set
  your own with `update_run(run_environment_id=..., launch_directory=...)`.
- **IDs, not names.** Every `run_id`, `project_id` and `pipeline_id` comes from a prior response.

## Ordered blueprint

### A. New run from a pipeline (default)

1. **Project.** `list_projects()` (read). If none fits, confirm: *"I'll create a project called
   `<name>`, proceed?"* then `create_project(name="<name>")`.
2. **Pipeline.** `list_pipelines(search="<words>")` (read), or `recommend_pipeline(goal)` for a
   suggestion. Let the user pick; `plan_run(pipeline_id)` shows which decisions matter, if an
   example run exists.
3. **Create the run.** Confirm: *"I'll create a run `<name>` of `<pipeline>` in project
   `<project>`, nothing launches yet, proceed?"* then `create_run(pipeline_id, project_id, name)`.
   Note `run_id`, `permission`, `groupId`, `inputs`, `run_environments`,
   `proposed_execution_directory`.
4. **Fill the form.** Ask the user for each input that needs a value. Show the run environments
   by name and host; for the chosen one, show the proposed execution directory and ask to accept or
   change it (`null`: ask for one).
5. **Save.** Confirm: *"I'll save run `<run_id>`: inputs `<summary>`, run environment `<name>`,
   execution directory `<path>`, proceed?"* then
   `update_run(run_id, inputs=[...], run_environment_id=<id>, launch_directory="<path>",
   permission=<from form>, group_id=<only if 15>)`.
6. **Preflight.** `preflight_run(run_id)` (read). Fix every `fail` with another confirmed
   `update_run`.
7. **Launch.** Confirm: *"I'll launch run `<run_id>` now, this starts compute, proceed?"* then
   `initiate_run(run_id, run_type="newrun")`. Note `runUUID`, `localRunDir`.
8. **Monitor.** `get_run(run_id)` or `watch_run(run_id)` until it resolves. If it failed, call
   `get_run_log(run_id)` and report the actual error. Never retry `initiate_run` on your own: a
   retry is a new execute and needs its own confirmation.

### B. Copy an existing run

1. `get_run_details(source_run_id, verbose=True)` (read). Note `inputs[]`, `processOptions{}`,
   `permission`, `groupId`, `mainPipeline.id`, `project.id`.
2. *(only if new data needs a dataset)* Confirm, then `create_vmeta_dataset(name)`; confirm each
   file, then `add_files_to_dataset(dataset_id, file_data)`.
3. Confirm: *"I'll duplicate run `<source_run_id>` into project `<project_id>`, proceed?"* then
   `duplicate_run(run_id, project_id, pipeline_id)`. Note `duplicatedRunId` as `new_run_id`.
4. `list_run_environments(new_run_id)` (read). If the copied environment is not one of yours, pick
   one with the user and show its proposed directory.
5. Confirm: *"I'll update run `<new_run_id>`: `<one-line summary>`, proceed?"* then
   `update_run(run_id=new_run_id, inputs=[...], process_options={...}, permission=<echoed>,
   run_environment_id=<if changed>, launch_directory=<if changed>)`. Re-check what the duplicate
   dropped first.
6. `preflight_run(new_run_id)`, then steps A7 and A8.

## Worked examples

**A. "Run the RNA-seq pipeline on my samples in a new project"**

1. Confirm *"I'll create a project called `RNA-seq October`, proceed?"* then
   `create_project(name="RNA-seq October")` gives project `51`.
2. `list_pipelines(search="rna-seq")`; the user picks pipeline `1405`.
3. Confirm *"I'll create run `first pass` of RNA-seq in project 51, nothing launches yet,
   proceed?"* then `create_run(pipeline_id=1405, project_id=51, name="first pass")` gives
   `run_id` `12401`, `permission` `3`, environment `550` ("Cluster", login `jdoe`) and proposed
   directory `/home/jdoe/foundry-connect-runs/first_pass`.
4. Ask for the inputs (reads dataset, genome build); the user accepts the proposed directory.
5. Confirm *"I'll save run 12401: reads = dataset X, genome = human_hg38, run environment Cluster,
   directory /home/jdoe/foundry-connect-runs/first_pass, proceed?"* then
   `update_run(run_id="12401", inputs=[...], run_environment_id=550,
   launch_directory="/home/jdoe/foundry-connect-runs/first_pass", permission=3)`.
6. `preflight_run(run_id="12401")`: all checks pass.
7. Confirm *"I'll launch run 12401 now, this starts compute, proceed?"* then
   `initiate_run(run_id="12401", run_type="newrun")`.
8. `watch_run(run_id="12401")`; report the result, with `get_run_log` if it failed.

**B. "Duplicate run 12345 with the new fastqs from dataset X and launch it"**

1. `get_run_details(run_id="12345", verbose=True)`.
2. Confirm, then `duplicate_run(run_id="12345", project_id=<project.id>,
   pipeline_id=<mainPipeline.id>)` gives `duplicatedRunId` `67890`.
3. `list_run_environments(run_id="67890")`: the copied environment is not the user's, so pick
   theirs and show its proposed directory.
4. Confirm *"The duplicate dropped `reads` and cleared processOptions arrays. I'll set `reads` to
   dataset X, restore `<processOptions summary>`, and use run environment `<name>` with directory
   `<path>` on run 67890, proceed?"* then `update_run(...)`.
5. `preflight_run(run_id="67890")`, then confirm and `initiate_run(run_id="67890",
   run_type="newrun")`, then monitor.

Each numbered write or execute step above needs its own "yes" immediately before the call, even
though the whole flow was described in one request. This matches `share-back.md` and `author.md`.
