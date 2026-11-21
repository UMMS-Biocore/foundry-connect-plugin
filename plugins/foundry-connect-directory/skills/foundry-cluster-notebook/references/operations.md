# Cluster notebook operations

Tools: `hpc_app_launch`, `hpc_app_list`, `hpc_app_status`, `hpc_app_stop`, `app_execute` and
`app_operation_status`. Every answer is JSON text. A failure is an error whose JSON holds
`error`, `reason`, and sometimes `op_id` and `http_status`.

## Launch tools

| Tool | Read/Write | Notes |
| --- | --- | --- |
| `hpc_app_launch(app, run_environment_id, data_roots, cpus, memory_mb, wall_minutes)` | **Execute, confirm first** | Defaults: `app="marimo"`, `cpus=1`, `memory_mb=4096`, `wall_minutes=60`. `data_roots` entries are a name (read only) or `{"name": ..., "mode": "rw"}`. With several run environments and id 0 it returns `needs_choice` and starts nothing. Returns `launch`, `mounts` and `open_in_foundry_connect`. A failure with reason `outcome_unknown` means the job may exist: call `hpc_app_list` before launching again. |
| `hpc_app_list()` | Read | Your launches and the page link. |
| `hpc_app_status(launch_id)` | Read | The launch, its mounts and the link. |
| `hpc_app_stop(launch_id)` | **Confirm first** | Answers with the launch, stopping or ended. On `outcome_unknown`, check `hpc_app_status` before stopping again. |

Data roots map to `/mnt/<name>`. The link is the cluster launches page. There is no page per
launch.

## app_execute

`app_execute(launch_id, op, op_id="", notebook="notebook.py", code="", cell_id="",
expected_code_sha256="", after="", run=True, timeout_seconds=300, wait_seconds=45)`

| `op` | Arguments used | What it does |
| --- | --- | --- |
| `execute` | `code` | Runs code in a scratchpad copy of the kernel globals. Notebook variables are readable. New top level names are discarded after the call. Never use it to change cells (no `marimo._code_mode`): it has no conflict check. |
| `create_cell` | `code`, `run`, `after` | Adds a cell, optionally after the cell id in `after`, and runs it when `run` is true. |
| `edit_cell` | `cell_id`, `code`, `expected_code_sha256`, `run` | Replaces a cell's code only if its hash still matches. |
| `run_cell` | `cell_id` | Runs a cell. Reactive descendants run too. |
| `delete_cell` | `cell_id`, `expected_code_sha256` | Deletes a cell only if its hash still matches. |
| `cells` | none | Returns each cell's `id`, `name`, `code`, `codeSha256`, `status` and `output`, capped. Copy `codeSha256` into `expected_code_sha256`. |
| `status` | none | Returns the kernel state: `running`, `idle` or `stopped`. |
| `interrupt` | none | Interrupts the running cell. |

`op_id` identifies one operation. Leave it empty to get a fresh one, and keep the one you are
given. Sending the same `op_id` again returns the stored answer (`replayed: true`) and never
runs the code twice. Never reuse an `op_id` for different code.

`wait_seconds` (0 to 50, default 45) is how long the call waits before it answers `running`.
`timeout_seconds` (1 to 3600, default 300) is how long the code may run before the adapter
interrupts it.

A 409 with reason `app_origin_not_isolated` means nothing ran: the installation does not serve
apps on their own origin yet. Tell the person an administrator must enable it. Do not retry.

## app_operation_status

`app_operation_status(launch_id, op_id, wait_seconds=25)` waits up to `wait_seconds` (0 to 50) for the
operation to finish and answers with its state. Use it for any `running` answer.

## Answer fields

`op_id`, `op`, `state`, `reason`, `truncated`, `outputBytes`, `events`, `result`, `replayed`,
`outputRetained`, `sessionRestarted`, and `next_step` for `running`, `outcome_unknown` and
`conflict`.
Images in output arrive as attachments, and the text says `[image attached]`.

| `state` | Meaning | You do |
| --- | --- | --- |
| `succeeded` | Finished. | Summarize the result. |
| `running` | Still going after the wait. | Poll with `app_operation_status`. Do not resend. |
| `failed` | Did not complete. | Report `reason`. Do not retry blindly. |
| `conflict`, `reason: conflict` | The cell changed since your read. Nothing written. | Show their code, ask. |
| `conflict`, `reason: conflict_after_write` | Your write was applied, then the cell changed. It no longer holds your code. | Say your edit landed and was replaced, show current code, ask. Do not overwrite. |
| `outcome_unknown` | Cannot tell if it ran. | Never rerun. Read `cells` and `status`, ask. |
| `cancelled` | Stopped by interrupt, timeout, stop or revocation. | Report, ask before retrying. |

Known gap: a person's edit that reaches the server while your edit is in flight can be
overwritten without a `conflict` answer. This is only possible after **Take over**. Read `cells`
again after an edit when the person is typing in the notebook.

## Output cap

Each call returns at most 65,536 bytes of output in total. Past that the answer is `truncated`.
Print counts, shapes and short samples.
