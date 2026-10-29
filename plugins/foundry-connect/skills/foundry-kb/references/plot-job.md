# Numbers and plots from a workspace job

Every number about the data, and every plot, comes from a Foundry Connect workspace job that reads
named run report files next to the data and returns what it read and drew with a provenance block.
Result tables are often several megabytes, far too large to load into a chat, and a value the model
works out itself cannot be checked. A job's output can.

## 1. Pin the inputs

From the KB brief and the run's `source.md`, name:

- the Foundry run id (the `report_id`) and each report file, its path exactly as
  `get_all_report_paths(report_id=<run id>)` lists it;
- the feature column and the value columns to read or draw;
- the filter, in the grammar of `answer-contract.md`;
- the claims the figure should mark (for example features a paper reports as up), by claim id.

If the run is not on the instance, or the file is not listed, say so and abstain on the numbers.

## 2. A workspace

`workspace_list` first, and reuse a `ready` workspace on a run environment of the project. Only if
none fits, propose `workspace_create(run_environment_id, project_id, name, image)` with a one line
summary (it creates a folder on the cluster) and call it after a "yes". The image needs Python 3
with matplotlib for a plot; ask the user for one their environment allows if you do not know.

## 3. How the job reaches the report file

- **A folder the workspace can see.** If the workspace owner made the run's report folder visible
  to jobs, the script reads the file from there. Ask the user, or read it from the workspace's
  details, rather than guessing a path.
- **A signed download link.** Otherwise call `download_file(report_id, file_path)` right before
  submitting. A large file comes back as `download_url`; the script fetches it. The link expires
  in about 15 minutes and works without a sign in, so put it only in the job command, never in
  the answer, and fetch a new one rather than reuse an old one. A job that waits for approval past
  the expiry needs a new link and a new job. A small file comes back inline instead, with no link;
  then use a visible folder, or tell the user the file cannot reach the job yet and abstain.

## 4. The script

Pick the job's `submission_key` now (letters, digits and `. _ : -`, at most 128 characters, never
`.` or `..`), because the script writes into a folder named after it. Write a script for the
question. It must:

1. read each input file's bytes once, and compute sha256 over exactly those bytes;
2. parse them, apply the filter as written, and count `rows_read`: the data rows parsed before
   the filter, header excluded;
3. compute what the question asks (a count, a top list, a summary) and, for a plot, draw it,
   marking the features the named claims cover;
4. write these fixed names into `/workspace/outputs/<submission_key>/` (the job's working
   directory is `/workspace`); they are the only files `get_job_result` reads:
   - `figure.png`, for a plot: a PNG of at most 384 KiB (dpi 100 to 150 and a modest figure size
     keep it there). A larger file, or one that is not a PNG, comes back as unavailable.
   - `values.csv`: a header line, then one row per plotted point or bar, or per value the answer
     will state, feature first. At most 500 data rows and 128 KiB come back, so keep the table
     small and put the rows the answer needs first.
   - `provenance.json`: a JSON list with one block per input file (a single object is also
     accepted), each `{"run", "file", "sha256", "filter", "rows_read"}`: `run` the Foundry run id,
     `file` the report path as listed, `sha256` 64 lowercase hex characters, `filter` as written,
     `rows_read` a whole number. At most 50 blocks and 32 KiB. One block out of shape makes the
     whole file unavailable.
   - `script.py`: a copy of itself, so the plot reruns. It is not returned; it stays in the
     workspace.
5. print nothing the answer depends on. Standard output and error come back only as their last
   12 KiB, to diagnose a failure, never as a source of values.

A template, to adapt (made up names; it reads a comma separated table):

```python
import csv, hashlib, io, json, os, shutil, sys, urllib.request

RUN = "5001"                                  # Foundry run id
FILE = "DE/TRT_vs_CON.DE.csv"                 # report path as listed
SOURCE = os.environ.get("SRC", "")            # a visible path, or the download link
KEY = os.environ["KEY"]                       # the job's submission_key
FILTER = "padj < 0.05 top 20 by abs(log2FoldChange)"
MARK = {"GENEA", "GENEB"}                     # features the cited claims cover
BASE = os.environ.get("OUTPUTS", "/workspace/outputs")
OUT = os.path.join(BASE, KEY)
FIGURE_MAX = 384 * 1024

os.makedirs(OUT, exist_ok=True)
shutil.copy(sys.argv[0], os.path.join(OUT, "script.py"))
raw = urllib.request.urlopen(SOURCE).read() if SOURCE.startswith("https://") else open(SOURCE, "rb").read()
sha = hashlib.sha256(raw).hexdigest()
rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8"))))   # data rows, header excluded
feature = list(rows[0].keys())[0]

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

kept = [r for r in rows if num(r["padj"]) is not None and num(r["padj"]) < 0.05]
kept.sort(key=lambda r: abs(num(r["log2FoldChange"]) or 0), reverse=True)
kept = kept[:20]

with open(os.path.join(OUT, "values.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow([feature, "log2FoldChange", "padj", "marked"])
    for r in kept:
        w.writerow([r[feature], r["log2FoldChange"], r["padj"], r[feature] in MARK])

prov = [{"run": RUN, "file": FILE, "sha256": sha, "filter": FILTER, "rows_read": len(rows)}]
with open(os.path.join(OUT, "provenance.json"), "w") as f:
    json.dump(prov, f, indent=1)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
names = [r[feature] for r in kept]
vals = [num(r["log2FoldChange"]) for r in kept]
plt.figure(figsize=(6, min(8, max(3, len(names) * 0.3))))
plt.barh(names, vals, color=["#c0392b" if n in MARK else "#7f8c8d" for n in names])
plt.xlabel("log2FoldChange"); plt.title(FILE); plt.tight_layout()
plt.savefig(os.path.join(OUT, "figure.png"), dpi=120)

size = os.path.getsize(os.path.join(OUT, "figure.png"))
print("wrote", OUT, "figure_bytes", size, "rows_read", len(rows), "kept", len(kept))
if size > FIGURE_MAX:
    sys.exit("figure.png is over 384 KiB; lower the dpi or the figure size")
```

The job command writes the script to a file and runs it, so it can copy itself:

```bash
set -e
mkdir -p /workspace/kb-scripts
cat > /workspace/kb-scripts/<submission_key>.py <<'PY'
<the script>
PY
KEY='<submission_key>' SRC='<visible path or download link>' python3 /workspace/kb-scripts/<submission_key>.py
```

Use the same `submission_key` in the command and in the `workspace_run` call. Keep the command
under 32 KiB. A question that needs several files reads them all in one job and writes one
provenance block per file.

## 5. Submit and follow

Before `workspace_run`, show the user one line: the workspace, the files it reads, what it computes
or draws, and `cpus`, `memory_mb` and `wall_minutes` (1 CPU, 2048 MB and 15 minutes cover one
table of a few megabytes). Call it after a "yes", with the fresh `submission_key` the command
names. Then:

- `submitted`: follow it with `workspace_job_status(workspace_id, submission_key)` until it is
  `completed` or `failed`.
- `awaiting_approval` or `review_stale`: share the `approve_at` link; a person must approve it.
- `uncertain`: check with `workspace_job_status`, or call again with the **same** key. Never a new
  key for it, or the job may run twice.
- A refusal: report its `reason` and `next_step`. Do not retry on a new key without the user.

## 6. Read the result back

When `workspace_job_status` says `completed` or `failed`, call
`get_job_result(workspace_id, submission_key)`. It is read only and needs no "yes". It returns:

- `status` and `exit_code`, `output_dir` (`outputs/<submission_key>`) and `job_uri`;
- `figure`: its path, size and uri, with the PNG itself attached as an image. Show it;
- `values`: `csv` (the header and at most 500 data rows), `rows`, `truncated` and `uri`;
- `provenance`: the blocks as the server checked them, `run` always a string;
- `stdout` and `stderr`: the last 12 KiB of each, with `truncated`;
- `unavailable`: each file that did not come back and why (`absent`, `not_regular_file`,
  `unreadable`, `too_large` or `invalid`).

Bind every number to what it returned and to nothing else:

- a value from the table: `[src: job://<workspace id>/<submission key>/values.csv#row=<first column value>&col=<column>]`;
- a count or total over an input: `[prov: ...]`, copying that input's block as returned
  (`rows_read` is the data rows before the filter, header excluded, never the count that passed);
- the figure: `job://<workspace id>/<submission key>/figure.png`.

If `values.truncated` is true, only the returned rows exist for the answer; say the table was
longer and give its `output_dir`. If a file is in `unavailable`, or `provenance` is null, say so
and abstain on what it would have held; never rebuild it from stdout or from a local table. A
`failed` job, or a nonzero `exit_code`, produced no numbers: report it with the end of `stderr`,
and offer to fix the script and run it again on a new "yes" with a new key.

When `get_job_result` refuses, its `reason` says why:

- `job_not_finished`: keep following `workspace_job_status`, then call it again.
- `result_not_supported`: this job's result cannot be read through Foundry Connect. The usual
  causes are a remote compute agent older than 0.10.0 on the run environment, a job that ran
  inside a session instead of as its own job, or a key that cannot name a folder. Tell the user
  the outputs are in the workspace under `outputs/<submission_key>/` and abstain on the numbers.
  Never fall back to values printed in stdout, a number you work out, or a local table.
- `result_unreadable`: the workspace's folders are not where they should be, so nothing was read.
  Report it and abstain.
- `environment_unreachable` (HTTP 503): the run environment could not be reached. Try once more
  later; if it persists, report it and abstain.
- `job_not_found`, or `not_found_or_disabled` from a server that has no result route: report it
  and abstain. The same holds when no `get_job_result` tool is in the tool list: the MCP server is
  older than this skill, so the outputs cannot reach the conversation.
