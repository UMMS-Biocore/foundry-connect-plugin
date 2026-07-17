# Share results back

Purpose: push results (files, datasets, collections) back into ViaFoundry. **Every tool in this
file is a write.** Per the skill's safety model, confirm each write with a one-line
plain-language summary of exactly what will be created or changed *before* calling it — never
chain writes on a single earlier "yes."

## Tools (all writes — confirm first)

| Tool | Usage |
| --- | --- |
| `upload_file(report_id, file_name, file_content_base64, remote_dir)` | Upload a file into an existing run/report. `remote_dir` must be a real directory in that report — look it up first with `get_report_dirs` or `list_processes` from `explore-access.md`. Content is base64-encoded bytes. |
| `create_vmeta_dataset(name)` | Create a new, empty vmeta ("study tracker") dataset. Returns its `_id`. `name` must be non-empty and unique within the project. |
| `add_files_to_dataset(dataset_id, file_data)` | Add one file record to an existing dataset. `dataset_id` is the `_id` from `create_vmeta_dataset` (or another known dataset). `file_data` needs `canvasId` (the study-tracker canvas ID) and `file` (a metadata dict, e.g. `{"name": ..., "path": ...}`). One call adds one file — for multiple files, call it once per file. |
| `create_collection(collection_data)` | Create a new dataset collection. `collection_data` needs `name`, `label`, and `canvasID` at minimum. |

If `canvasId`/`canvasID` isn't already known from context, ask the user rather than guessing.

## Worked example

**"Save these two CSVs into a new dataset"**

1. Confirm the whole action up front, since it's one described intent: *"I'll create a new vmeta
   dataset called `<name>` and add `file1.csv` and `file2.csv` to it — proceed?"*
2. `create_vmeta_dataset(name="<name>")` → note the returned `_id`.
3. `add_files_to_dataset(dataset_id="<_id>", file_data={"canvasId": "<canvas id>", "file": {"name": "file1.csv", ...}})`
4. `add_files_to_dataset(dataset_id="<_id>", file_data={"canvasId": "<canvas id>", "file": {"name": "file2.csv", ...}})`

One upfront confirmation covers this because every call it authorizes was named in that
confirmation. If the plan changes mid-flow — an extra file, a different dataset name because of a
collision, a different target — stop and get a fresh confirmation before making that additional
write.
