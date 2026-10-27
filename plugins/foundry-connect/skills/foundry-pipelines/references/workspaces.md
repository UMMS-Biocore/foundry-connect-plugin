# Run commands in a workspace

Purpose: run commands in a container on a run environment's workspace with `workspace_list`,
`workspace_create`, `workspace_run`, `workspace_job_status` and `workspace_cancel`. Each job uses
cluster compute, so `workspace_run` gets its own explicit "yes" before the call, like any launch.

## A chain of steps without keeping a session open

When the user wants several steps run one after another (for example a job, then a check on its
output, then the next step only if the check passed), **offer this before asking them to keep the
session open between steps.** When no step needs a person's decision, the whole chain already
works as **one** workspace job, and the user can close the laptop once it is submitted:

1. Write one script that runs the steps in order under `set -e`, so the first failing step stops
   the job. A gate step ends with `exit 1` when its check fails, so later steps never run on bad
   output.
2. Submit it with one `workspace_run`: `cpus` and `memory_mb` are those of the largest step, and
   `wall_minutes` covers all steps together. Confirm with the user first.
3. Follow it later with `workspace_job_status` and the `submission_key` it returned.

Tell the user the trade-off before they say yes: every step gets the largest step's resources, and
nobody can review a result between steps. When a person must look at a result before the next
step runs, submit those steps as separate jobs instead.
