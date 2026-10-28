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

Write a script for the question. It must:

1. read each input file's bytes once, and compute sha256 over exactly those bytes;
2. parse them, apply the filter as written, and count `rows_read` (data rows parsed, before the
   filter);
3. compute what the question asks (a count, a top list, a summary) and, for a plot, draw it,
   marking the features the named claims cover;
4. write into one output folder: `figure.png` (for a plot), `values.csv` (one row per plotted
   point or bar, or per value the answer will state, feature first), `provenance.json` (one block
   per input file), and `script.py` (a copy of itself);
5. print `provenance.json` and the first 500 rows of `values.csv` to standard output between
   clear markers, so the values can be read back.

A template, to adapt (made up names; it reads a comma separated table):

```python
import csv, hashlib, io, json, os, shutil, sys, urllib.request

RUN = "5001"                                  # Foundry run id
FILE = "DE/TRT_vs_CON.DE.csv"                 # report path as listed
SOURCE = os.environ.get("SRC", "")            # a visible path, or the download link
FILTER = "padj < 0.05 top 20 by abs(log2FoldChange)"
MARK = {"GENEA", "GENEB"}                     # features the cited claims cover
OUT = "kb-job-output"

os.makedirs(OUT, exist_ok=True)
shutil.copy(sys.argv[0], os.path.join(OUT, "script.py"))
raw = urllib.request.urlopen(SOURCE).read() if SOURCE.startswith("https://") else open(SOURCE, "rb").read()
sha = hashlib.sha256(raw).hexdigest()
rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8"))))
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
json.dump(prov, open(os.path.join(OUT, "provenance.json"), "w"), indent=1)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
names = [r[feature] for r in kept]
vals = [num(r["log2FoldChange"]) for r in kept]
plt.figure(figsize=(6, max(3, len(names) * 0.3)))
plt.barh(names, vals, color=["#c0392b" if n in MARK else "#7f8c8d" for n in names])
plt.xlabel("log2FoldChange"); plt.title(FILE); plt.tight_layout()
plt.savefig(os.path.join(OUT, "figure.png"), dpi=150)

lines = open(os.path.join(OUT, "values.csv")).read().splitlines()
print("=== PROVENANCE ===")
print(json.dumps(prov))
print("=== VALUES ===")
print("\n".join(lines[:501]))
print("=== END ===")
```

The job command writes the script to a file and runs it, so it can copy itself:

```bash
set -e
mkdir -p kb-job && cd kb-job
cat > plot.py <<'PY'
<the script>
PY
SRC='<visible path or download link>' python3 plot.py
```

Keep the command under 32 KiB. A question that needs several files reads them all in one job and
writes one provenance block per file.

## 5. Submit and follow

Before `workspace_run`, show the user one line: the workspace, the files it reads, what it computes
or draws, and `cpus`, `memory_mb` and `wall_minutes` (1 CPU, 2048 MB and 15 minutes cover one
table of a few megabytes). Call it after a "yes", with a fresh `submission_key` of your choosing
for a new job. Then:

- `submitted`: follow it with `workspace_job_status(workspace_id, submission_key)`.
- `awaiting_approval` or `review_stale`: share the `approve_at` link; a person must approve it.
- `uncertain`: check with `workspace_job_status`, or call again with the **same** key. Never a new
  key for it, or the job may run twice.
- A refusal: report its `reason` and `next_step`. Do not retry on a new key without the user.

## 6. Read the result back

When the job is `completed`, read its values and provenance from what the tools return for it.
Cite job outputs as `job://<workspace id>/<submission key>/<output path>` and the provenance block
with `[prov: ...]`, copying it as returned. Show the figure when a tool returns it; otherwise give
its output path. If no tool returns the job's outputs to the conversation, tell the user where they
are and abstain on the numbers. Never fill them in from your own reading of a local table.

A job that ended `failed` produced no numbers. Report it, and offer to fix the script and run it
again on a new "yes".
