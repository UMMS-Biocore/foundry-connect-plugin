# Explore & access runs

Purpose: inspect pipeline runs and pull result data out of ViaFoundry so it can be reviewed or
analyzed in chat. Every tool below is **read-only** — no side effects, no confirmation needed.

Note on IDs: a run's `report_id` is the same value as its run ID. Tools that say `report_id` accept
the ID you got back from `list_runs` / `get_run`.

## Tools

| Tool | Usage |
| --- | --- |
| `list_runs(search_query, take, skip, sort, order)` | List/search runs. Fuzzy-searches by name, paginated (`take`/`skip`), sorted (default `dateCreated desc`). Returns id, name, status, pipeline info, dates. Start here to find a run's ID. |
| `get_run(run_id, run_name, include_reports)` | Get one run by ID, or by name with fuzzy matching if no exact match exists. Pass `include_reports=True` to also get its associated reports. |
| `get_run_details(run_id)` | Get the run's full execution shape: `inputs[]`, `processOptions{}`, `permission`, `groupId`, `mainPipeline`. Useful context before an execute-flow (see `execute.md`), but itself just a read. |
| `list_processes(report_id)` | List the unique process (pipeline step) names that produced output in this run. |
| `list_files(report_id, process_name)` | List files in the run, optionally filtered to one process/step. Returns paths, sizes, extensions. |
| `get_report_dirs(report_id)` | List the directories in a report where files could be uploaded (used later by `share-back.md`'s `upload_file`). |
| `get_all_report_paths(report_id)` | List every accessible file path in the report — the fastest way to search for a specific result file by name. |
| `download_file(report_id, file_path)` | Fetch a file's raw bytes (base64-encoded) so it can be saved locally or handed back to the user. |
| `load_file(report_id, file_path, separator)` | Read a file's contents directly into the conversation. Tabular files (CSV/TSV/TXT) come back as a formatted table; anything else comes back as raw text. This is how you get data in front of Claude for analysis — no download needed. |
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
- To save anything back into ViaFoundry (upload a file, create a dataset), that's a write — see
  `share-back.md` and confirm first.
