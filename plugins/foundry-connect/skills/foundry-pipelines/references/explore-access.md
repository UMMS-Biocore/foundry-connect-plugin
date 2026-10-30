# Explore & access runs

Purpose: inspect pipeline runs and pull result data out of Foundry Connect so it can be reviewed or
analyzed in chat. Every tool below is **read-only** — no side effects, no confirmation needed.

Note on IDs: a run's `report_id` is the same value as its run ID. Tools that say `report_id` accept
the ID you got back from `list_runs` / `get_run`.

## Tools

| Tool | Usage |
| --- | --- |
| `list_runs(search_query, take, skip, sort, order)` | List/search runs. Fuzzy-searches by name, paginated (`take`/`skip`), sorted (default `dateCreated desc`). Returns id, name, status, pipeline info, dates. Start here to find a run's ID. |
| `get_run(run_id, run_name, include_reports)` | Get one run by ID, or by name with fuzzy matching if no exact match exists. Includes a plain-language `status_display` ("Running"/"Completed"/"Failed"). Pass `include_reports=True` to also get its associated reports. |
| `get_run_log(run_id, attempt_id)` | **The tool to reach for when a run failed.** Returns the tail of the most relevant execution log (`.command.err`/Nextflow) plus a plain-language summary — this is how you answer "why did it fail?". If logs haven't synced yet on a cluster run, it says so; try again shortly. |
| `get_run_details(run_id, verbose=False)` | Default: a compact plain-language summary of the run's configuration (pipeline, samples, key settings) — good for "how was this run set up?". Pass **`verbose=True`** for the full execution shape (`inputs[]`, `processOptions{}`, `permission`, `groupId`, `mainPipeline`, `project`), which is what an execute-flow needs (see `execute.md`). Read-only either way. |
| `list_processes(report_id)` | List the unique process (pipeline step) names that produced output in this run. |
| `list_files(report_id, process_name)` | List files in the run, optionally filtered to one process/step. When no step has that name it lists the top level results folder of that name instead, and if neither matches the error names the steps and folders you can use. Returns paths, sizes, extensions. |
| `get_report_dirs(report_id)` | List the directories in a report where files could be uploaded (used later by `share-back.md`'s `upload_file`). |
| `get_all_report_paths(report_id)` | List every accessible file path in the report — the fastest way to search for a specific result file by name. |
| `download_file(report_id, file_path)` | Fetch a file so it can be saved locally or handed back to the user. A file up to 48KB comes back as its raw bytes (base64-encoded). **A larger file comes back with `"action": "fetch_in_sandbox"`, a `download_url` and a ready `download_command`** (a `curl` line): run that command in your code sandbox to save the file and process it there, or give the user the link to open in a browser. The link expires; call again for a new one. `delivery="inline"` forces the bytes up to 5MB, but never ask for a large file's bytes inline; they do not fit in one tool result. |
| `load_file(report_id, file_path, offset, limit, columns, separator, format)` | Read a table into the conversation **one page at a time**. Tabular files (CSV/TSV/TXT, also `.gz`) come back as `columns` once plus `rows` as arrays, `limit` rows from `offset` (default 200, at most 2000), with `has_more` and `next_offset`. Pass `columns` to keep only the ones you need. A page that hits the size cap sets `truncated`; continue from `next_offset`. `format="records"` gives one object per row under `data` instead. A file that is not a table comes back as text up to 64KB and is refused above that: use `download_file` for it. Read only the pages the question needs; for a whole large table, fetch it with `download_file` and work on it in the sandbox. |
| `fetch_report(report_id)` | Fetch the complete raw report JSON for a run (all processes, files, and metadata in one call) — useful when you need everything at once instead of drilling down. |

## Worked examples

**"Show my last 5 runs"**
→ `list_runs(take=5)` (default sort is newest first).

**"Load the MultiQC summary from run 12345"**
→ `get_all_report_paths(report_id="12345")` (or `list_files(report_id="12345")`) to find the
MultiQC file's path → `load_file(report_id="12345", file_path="<path found above>")`.

## Where to go next

- To do something with the data you just loaded (summarize, compute stats, build a table), see
  `analyze.md` — no tool call needed, it's native reasoning in chat.
- To save anything back into Foundry Connect (upload a file, create a dataset), that's a write — see
  `share-back.md` and confirm first.
