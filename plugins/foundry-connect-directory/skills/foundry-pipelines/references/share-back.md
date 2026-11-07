# Share results back

Purpose: push results (files, datasets, collections) back into Foundry Connect. **Every tool in this
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
| `update_metadata_record(canvas_id, collection_name, data_id, update_data)` | Change fields on one existing record. Only the keys in `update_data` change. `_id`, `owner`, `perms` and `DID` are refused. |
| `update_metadata_records(canvas_id, collection_name, updates)` | Change fields on many records in one collection. `updates` is a list of `{"data_id", "update_data"}`. Every row is checked first: one invalid row means nothing is written. After that each record gets its own result in `results`, so report any `ok: false` rows. The one write confirmed once for the whole set (see below). |

If `canvasId`/`canvasID` isn't already known from context, ask the user rather than guessing.

## Worked example

**"Save these two CSVs into a new dataset"**

1. Confirm: *"I'll create a new vmeta dataset called `<name>` — proceed?"*
2. `create_vmeta_dataset(name="<name>")` → note the returned `_id`.
3. Confirm: *"I'll add `file1.csv` to dataset `<name>` — proceed?"*
4. `add_files_to_dataset(dataset_id="<_id>", file_data={"canvasId": "<canvas id>", "file": {"name": "file1.csv", ...}})`
5. Confirm: *"I'll add `file2.csv` to dataset `<name>` — proceed?"*
6. `add_files_to_dataset(dataset_id="<_id>", file_data={"canvasId": "<canvas id>", "file": {"name": "file2.csv", ...}})`

Each write gets its own confirmation immediately before it, even when several writes were
described together in the same request — never reuse an earlier "yes" for a later call.

**"Set the group on every sample in this dataset"**

1. `search_datasets(dataset_id="<dataset id>")` to get each record's `_id` and `name`. Read the
   canvas ID and collection name from the result, or ask.
2. Work out each new value. If a record does not fit the rule (for example a name with no `.repN`
   ending when the group is the name without it), stop and ask instead of guessing.
3. Show one table of `name`, `_id` and the new `group` for every record, then confirm once:
   *"I'll set `group` on these 24 records in collection `file`. Proceed?"*
4. `update_metadata_records(canvas_id="<canvas id>", collection_name="file", updates=[{"data_id": "<_id>", "update_data": {"group": "chow.wt"}}, ...])`
5. Report `updated` and `failed`, and list any rows with `ok: false`.
6. Read the records back with `search_metadata_records` and check that every one has the new value.
