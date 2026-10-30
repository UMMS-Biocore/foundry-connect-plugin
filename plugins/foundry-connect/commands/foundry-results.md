---
description: List and load result files/reports for a Foundry Connect run.
---

Use the `foundry-pipelines` skill's `references/explore-access.md`: for the named run, call `get_all_report_paths` / `list_files`,
show what's available, and `load_file` the ones the user asks for, a page of rows at a time (`offset`, `limit` up to 2000, `columns`; follow `next_offset` while `has_more` is true, only as far as the question needs; one answer holds at most 80,000 characters). If a download link is blocked in the claude.ai sandbox (proxy 403), page the file with `load_file` instead. Read-only.

$ARGUMENTS
