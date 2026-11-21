---
name: foundry-cluster-notebook
description: Use when a user wants a live marimo notebook on their cluster that Claude can work in alongside them, for example start a notebook, run Python on cluster data, add or edit a cell, or continue an existing cluster notebook session. Covers launching with hpc_app_launch, choosing data roots by name, sending operations with app_execute, polling with app_operation_status, handling conflict and outcome_unknown safely, and stopping the notebook, with confirm-before-write safety.
---

# Foundry Connect cluster notebook

A cluster notebook is a marimo notebook that runs as a job on the person's cluster, with their
data roots mounted read only or read write. Claude works in the same live kernel the person sees
in the browser. The notebook runtime is the source of truth, so never edit the notebook `.py`
file by another route.

This skill is adapted from the marimo pair skill by the marimo team (Apache License 2.0,
upstream commit `23ca56ab44791d9ace76fc1ee8ad59e34f8c8881`). No upstream NOTICE file exists at
that commit. The Foundry Connect transport and the safety rules below are our own.

## Safety model (always apply)

- `hpc_app_launch` starts a cluster job and uses the person's allocation. Before calling it,
  say in one line what will start (app, run environment, cpus, memory, wall minutes, data roots)
  and wait for an explicit yes.
- `hpc_app_stop` ends the notebook and its kernel state. Confirm first.
- `app_execute` runs code on the cluster as the person. For `execute`, `create_cell`,
  `edit_cell`, `run_cell` and `delete_cell`, tell the person what you are about to change or run
  before the first one in a turn, and ask again when the plan changes.
- Read operations (`cells`, `status`) and `hpc_app_list`, `hpc_app_status` and
  `app_operation_status` are free.

## Start a notebook

1. Ask which data roots the person wants, by name. Do not guess names. If they are unsure, ask
   them to check their run environment in the Foundry Connect web UI.
2. Show the mount map before launching. Each data root `<name>` is available inside the notebook
   at `/mnt/<name>`, so `labdata` becomes `/mnt/labdata`. The launch result returns the same
   `mounts` list, so show it again after launch.
3. Confirm, then call `hpc_app_launch(app="marimo", run_environment_id=..., data_roots=[...],
   cpus=..., memory_mb=..., wall_minutes=...)`. If it answers `needs_choice`, show the
   environments and ask which one, then call again with the id.
4. Give the person the `open_in_foundry_connect` link (the cluster launches page) so they can
   open the notebook in a browser. Say that a browser that joins is a reader at first and sees
   your edits live. After they press **Take over**, the browser becomes the editor and you can
   keep working. A notebook that is still queued has no kernel yet, so check `hpc_app_status`
   until it is running.
5. If the call fails with `execution_not_granted`, tell the person to reconnect the plugin or
   connector and tick the cluster execution permission, then retry. Do not work around it.

## Work in the notebook

1. Read before you edit. Call `app_execute(launch_id, op="cells")` and keep each cell's `cellId`
   and code hash. For `edit_cell` and `delete_cell`, pass `expected_code_sha256` from that read.
   A missing hash is refused.
2. Use `execute` for a scratch look (inspect a variable, sample a table, test a transform).
   New top level names made by `execute` are discarded after the call. Use `create_cell` for
   anything that should stay in the notebook, and `run_cell` to run one.
3. Output is capped per call and marked `truncated`. Print summaries (`df.shape`,
   `df.head()`, counts), not whole tables, and never print credentials.
4. `pip install` goes to the person's persistent library, so it survives restarts. Say what you
   are installing before you do it.
5. Public names in marimo have one owning cell. If a cell fails with multiply defined names,
   edit the owning cell or choose a new name.

The exact arguments of each operation and every result state are in
[references/operations.md](references/operations.md). Read it before the first operation.

## Results you must handle

- `running`: the operation outlived the wait. Call `app_operation_status(launch_id, op_id)` to
  poll, with the same `op_id`. Do not send the operation again.
- `conflict`: the person changed the cell since you read it. Nothing was written. Show the
  person's current code and ask what to do. Do not retry on your own.
- `conflict_after_write`: the cell no longer holds what you wrote. Show the current code and
  ask. Do not overwrite it.
- `outcome_unknown`: you cannot tell whether the code ran. Never rerun it. Read `cells` and
  `status`, compare with what you intended, report what you see, and ask the person how to go on.
- `cancelled` or an error with a reason: report it plainly. Do not retry blindly.
- `sessionRestarted: true`: the notebook kernel was replaced and its in memory variables are
  gone. Tell the person. Rerun setup cells (imports, data loading) only after asking.
  One known case: the first call after **Take over** can report this although the kernel is
  unchanged. Check with a small `execute` before assuming variables are lost.
- `replayed: true`: the backend returned the stored answer for that `op_id`. Nothing ran twice.

## Runaway work and ending

- Use `op="interrupt"` to stop a cell that runs too long. It stops the cell, not the notebook.
- Use `hpc_app_stop(launch_id)` to end the notebook after the person says they are done.
  Remind them to save anything they need, since the kernel state ends with the job.
- Stopping, revoking the execution permission or a restart cancels running operations. Their
  answer can be `cancelled` or `outcome_unknown`.

## What not to do

- Do not edit the notebook file on disk, and do not run shell commands to change it.
- Do not call the launch open endpoint or hand out any session URL. Give the cluster launches
  page link only.
- Do not rerun after `outcome_unknown`, and do not reuse an `op_id` for different code.
- Do not mount data roots the person did not name.
