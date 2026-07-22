# Execute (launch) a run

Purpose: duplicate an existing run, edit its inputs/options, launch it, and monitor progress. This
is the highest-stakes flow in the skill — it ends in **launching compute**. Per the skill's safety
model, every write and the execute call each get their own explicit, per-action "yes" with a
one-line plain-language summary *before* the call — never chain writes/execute on a single earlier
"yes," even when the whole flow was described in one request.

Most tools below hit endpoints under the run namespace, `/api/v1/run/...` (details, duplicate,
save, initiate-run); `create_vmeta_dataset`/`add_files_to_dataset` are the exception, under
`/api/v1/vmeta/...`.

## Tools

| Tool | Read/Write | Usage |
| --- | --- | --- |
| `get_run_details(run_id, verbose=True)` | Read | **`verbose=True` is required for this flow.** Without it the tool returns a compact human summary; only `verbose=True` returns the full execution shape you need: `inputs[]`, `processOptions{}`, `permission`, `groupId`, `mainPipeline` (has `.id` = pipeline_id), and `project` (has `.id` = project_id). Always call this on the **source** run first — it's where `project_id`, `pipeline_id`, and the `permission` you must echo into `update_run` all come from. |
| `create_vmeta_dataset(name)` | **Write — confirm** | Only if new data needs a fresh dataset. Creates an empty vmeta ("study tracker") dataset. `name` must be non-empty and unique in the project. Returns the dataset's `_id`. |
| `add_files_to_dataset(dataset_id, file_data)` | **Write — confirm** | Only if new data needs a fresh dataset. Adds one file record to the dataset from `create_vmeta_dataset`. `file_data` needs `canvasId` (study-tracker canvas ID) and `file` (metadata dict, e.g. `{"name": ..., "path": ...}`). One call per file — confirm each one separately, don't batch. |
| `duplicate_run(run_id, project_id, pipeline_id)` | **Write — confirm** | Clones the source run into a target project/pipeline. `project_id`/`pipeline_id` come from `get_run_details(source_run_id, verbose=True)` (`project.id` and `mainPipeline.id`). Returns the new run's ID as **`duplicatedRunId`** — that's the ID every later step uses. |
| `update_run(run_id, inputs, process_options, permission, group_id=None)` | **Write — confirm** | Patches the duplicated run's inputs/processOptions before launch. See Gotchas — this is the step most likely to be rejected by validation if the rules below aren't followed. |
| `initiate_run(run_id, run_type="newrun")` | **Execute — confirm** | Starts compute. `run_type` ∈ `newrun` (fresh), `resumerun` (Nextflow `-resume`, reuses work dir/cache), `rerun` (new attempt, same params). Returns `status`, `runUUID`, `localRunDir`. This is the point of no return in the flow — confirm explicitly, distinct from the `update_run` confirmation. |
| `get_run(run_id)` | Read | Poll after `initiate_run` to check status. Returns a plain-language `status_display` ("Running", "Completed", "Failed") alongside the raw status. Free, no confirmation. |
| `get_run_log(run_id, attempt_id=None)` | Read | **Use this when a run failed.** Returns the tail of the most relevant execution log (`.command.err`/Nextflow) plus a summary — this is how you answer "why did it fail?" without leaving chat. Free, no confirmation. If logs haven't synced yet (cluster runs), it says so; try again shortly. |

## Gotchas (exact rules — validation fails without these)

- **No empty-string input values.** In `inputs[]`, no entry's `value` may be `""`. Use `"NA"`, or
  omit the input entirely.
- **`permission` is required; `group_id` is conditionally required.** Always echo `permission`
  from the source run's `get_run_details(..., verbose=True)` into `update_run`. Pass `group_id` only when
  `permission == 15` (GroupShared) — it's required in that case and must be a valid group ID;
  otherwise leave it `None`/omit it.
- **Equal-length spreadsheet columns.** Within one `processOptions` entry, every list-typed
  (spreadsheet) column must be the same length as the others in that entry, or the save is
  rejected.
- **`duplicate_run` can silently drop data.** The duplicate may drop the run's vmetaCollection
  input (e.g. `reads`) and copy `processOptions` with empty arrays. Always re-check the duplicated
  run's shape and patch it back in via `update_run` before calling `initiate_run` — don't assume
  the duplicate is launch-ready as-is. Path-type inputs (references, genomes) are copied verbatim
  and may still point at the source project's paths; confirm those are still correct for the new
  project before launch.
- **IDs, not names.** `duplicate_run`'s `project_id`/`pipeline_id` and `update_run`'s `run_id` are
  all IDs pulled from a prior `get_run_details(..., verbose=True)`/`duplicate_run` response — don't
  guess or reuse the source run's ID past the duplicate step.
- **Don't build an `update_run` body from the compact `get_run_details`.** The default (non-verbose)
  response is a human summary and does **not** contain `inputs[]`/`processOptions{}`. Since
  `update_run` *replaces* `processOptions` wholesale, reconstructing a body from the compact shape
  would wipe the run's options. Always re-read with `verbose=True` first.

## Ordered blueprint

1. `get_run_details(source_run_id, verbose=True)` — read. `verbose=True` is required here; the
   default response is a compact summary without `inputs[]`/`processOptions{}`. Note `inputs[]`,
   `processOptions{}`, `permission`, `groupId`, and `mainPipeline.id`/`project.id` for later steps.
2. *(only if new data needs a dataset)*
   - Confirm: *"I'll create a new vmeta dataset called `<name>` — proceed?"*
   - `create_vmeta_dataset(name="<name>")` → note the returned `_id`.
   - Confirm: *"I'll add `<file>` to dataset `<name>` — proceed?"* (repeat, one confirm per file)
   - `add_files_to_dataset(dataset_id="<_id>", file_data={"canvasId": "<canvas id>", "file": {...}})`
3. Confirm: *"I'll duplicate run `<source_run_id>` into project `<project_id>` — proceed?"*
   `duplicate_run(run_id="<source_run_id>", project_id=<project_id>, pipeline_id=<pipeline_id>)`
   → note the returned `duplicatedRunId` as `new_run_id`.
4. Confirm: *"I'll update run `<new_run_id>`'s inputs/options: `<one-line summary of exactly what
   changes>` — proceed?"*
   `update_run(run_id="<new_run_id>", inputs=[...], process_options={...}, permission=<echoed>, group_id=<only if permission==15>)`
   — apply the Gotchas above before this call, especially re-checking what `duplicate_run` dropped.
5. Confirm: *"I'll launch run `<new_run_id>` now (`run_type=<newrun|resumerun|rerun>`) — this starts
   compute — proceed?"*
   `initiate_run(run_id="<new_run_id>", run_type="newrun")` → note `status`, `runUUID`,
   `localRunDir`.
6. Monitor: `get_run(new_run_id)` (read, no confirmation) until status resolves — its
   `status_display` gives you "Running"/"Completed"/"Failed" in plain language. Report the result
   plainly. **If it failed, call `get_run_log(new_run_id)` and report the actual error** rather than
   just the status. Do not retry `initiate_run` on your own initiative — a retry is a new execute and
   needs its own confirmation.

## Worked example

**"Duplicate run 12345 with the new fastqs from dataset X and launch it"**

1. `get_run_details(run_id="12345", verbose=True)` → read `permission`, `groupId`,
   `mainPipeline.id`, `project.id`, current `inputs`/`processOptions`.
2. Confirm: *"I'll duplicate run 12345 into project `<project.id>` on pipeline `<mainPipeline.id>` —
   proceed?"* → `duplicate_run(run_id="12345", project_id=<project.id>, pipeline_id=<mainPipeline.id>)`
   → `duplicatedRunId` = `67890`.
3. Confirm: *"Run 12345's duplicate dropped the `reads` input and cleared processOptions arrays — I'll
   set `reads` to dataset X and restore `<processOptions summary>` on run 67890 — proceed?"* →
   `update_run(run_id="67890", inputs=[...], process_options={...}, permission=<echoed>, group_id=<only if 15>)`.
4. Confirm: *"I'll launch run 67890 now (`run_type=newrun`) — proceed?"* →
   `initiate_run(run_id="67890", run_type="newrun")` → note `runUUID`/`localRunDir`.
5. `get_run(run_id="67890")` periodically until `status_display` resolves; report it. If it reads
   "Failed", call `get_run_log(run_id="67890")` and report the actual error, not just the status.

Each numbered write/execute step above needs its own "yes" immediately before the call, even
though the whole flow was described in one request — this matches `share-back.md` and `author.md`.
