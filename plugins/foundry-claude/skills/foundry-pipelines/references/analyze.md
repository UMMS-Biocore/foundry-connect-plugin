# Analyze loaded data

Purpose: once result data has been pulled into the conversation with `load_file` or `download_file`
(see `explore-access.md`), analyzing it is **native Claude reasoning in chat — no MCP tool call
involved**. There is no separate "analyze" tool; this file just describes how to do that reasoning
well.

## Guidance

- **Summarize QC output** — pull the key numbers out of a FastQC/MultiQC/similar file (read counts,
  duplication rate, GC content, pass/fail flags, adapter content, etc.) and state them plainly.
- **Compute simple stats** — means, ranges, totals, percentages, pass/fail counts — directly from
  the loaded table or text. This is ordinary reasoning over the data already in context; nothing
  needs to be executed remotely.
- **Make tables** — present multi-row/multi-sample comparisons as a markdown table rather than
  prose; it's easier to scan and to spot outliers.
- **Always cite the source** — name the exact `file_path` (and the run/report it came from) that
  the numbers are drawn from, so the user can trace any claim back to the file.
- **Nothing here touches the ViaFoundry API.** This step is pure reasoning over data that
  `explore-access.md`'s tools already fetched into the conversation. If new data is needed, go back
  to `explore-access.md` (still read-only, still free).

## After the analysis

If the user wants to keep the result — a summary file, a derived CSV, a new dataset — that's a
**write**. Do not create or upload anything from this step directly. Hand off to `share-back.md`,
which requires an explicit confirmation before any write tool is called.
