---
description: Start a Foundry Connect run from a pipeline (or copy an existing run), fill its inputs, choose where it runs, and launch it, with confirmation at each write.
---

Use the `foundry-pipelines` skill's `references/execute.md` blueprint. If the user names a pipeline
(or nothing), follow path A: choose or create a project, choose the pipeline, create the run, collect
the inputs, the run environment and the execution directory, preflight, then launch. If the user names
an existing run to copy, follow path B. Confirm each write with a one-line summary before calling.
Report the new run id and runUUID when it launches.

$ARGUMENTS
