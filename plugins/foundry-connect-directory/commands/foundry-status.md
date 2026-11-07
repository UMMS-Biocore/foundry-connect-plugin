---
description: Show the status of a Foundry Connect run.
---

Call `get_run` for the run the user names and report its status, attempt, and key timings — use the
plain-language `status_display` ("Running"/"Completed"/"Failed"), not the raw status code.

If it reads **Failed**, follow up with `get_run_log(run_id)` and tell the user *why* it failed (the
log tail names the failing step), rather than just reporting that it failed.

For how the run was configured, use `get_run_details(run_id)` — its default compact summary is the
right shape for this; only pass `verbose=True` if you actually need the raw editable config.

Read-only — no confirmation needed.

$ARGUMENTS
