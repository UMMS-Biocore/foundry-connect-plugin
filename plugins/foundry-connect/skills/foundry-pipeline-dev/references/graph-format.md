# Pipeline graph format

How Foundry Connect stores a pipeline graph, as its web editor saves it. Read this when a spec
will not plan, when an edge looks wrong in the editor, or when you need to reason about a saved
pipeline from `pipeline.py show`. The SDK (`viafoundry.pipelines`) writes all of this for you.

## Endpoints

| Call | Purpose |
| --- | --- |
| `GET /api/pipeline/v1/{id}/details` | read one pipeline; graph fields come back as JSON strings |
| `POST /api/pipeline/v1` | create (body without `id`) and save over (body with `id`) |
| `GET /api/v1/process/{id}` | a process, with its ordered `inputs` and `outputs` |
| `GET /api/parameter/v1` | parameter definitions (`id`, `name`, `fileType`, `qualifier`) |

A save replaces the whole pipeline in place: same id, same revision. `update_pipeline` therefore
reads the pipeline first and resends every field it does not change.

## Nodes

```json
{"g-1": {"nodeName": "gpu_smoke_check", "xCoordinate": 354, "yCoordinate": 389, "param": "3017", "nodeSettings": {}},
 "g-2": {"nodeName": "inputParam", "xCoordinate": 82, "yCoordinate": 453, "param": "inPro", "nodeSettings": {}},
 "g-3": {"nodeName": "HTML_Report", "xCoordinate": 768, "yCoordinate": 453, "param": "outPro", "nodeSettings": {"pubWeb": "html"}}}
```

- `param` is a **process id** (string), `inPro` for a pipeline input, or `outPro` for a pipeline output.
- An input's `nodeName` is the field label people see on the run page; name it for them.
- `nodeSettings.pubWeb` on an output (`html`, `rdata`, ...) shows that output as a report of that type.
- Details return each node as an array, `[x, y, param, nodeName, nodeSettings]`.

## Edges

Each end is a handle: `{o|i}-{param}-{slot}-{parameterId}-{N}`.

- `o` for an output, `i` for an input.
- `slot` is the 0-based position among that process's inputs or outputs. On `inPro`/`outPro` it is `1`.
- `parameterId` is the parameter definition on that end.
- `N` is the number in the node key `g-N`.

An edge is `{source}_{target}`, except an edge into a pipeline output, which the editor writes
outPro side first:

```
o-inPro-1-639-7_i-2357-0-639-5        pipeline input g-7 -> process 2357 slot 0
o-2357-0-131-5_i-2356-0-637-0         process 2357 output 0 -> process 2356 input 0
i-outPro-1-164-4_o-2356-1-164-0       process 2356 output 1 -> pipeline output g-4
```

## Type rule

The two ends of an edge may carry **different** parameter ids. Above, output 131 feeds input 637:
both are `directory` with qualifier `set`. The editor matches on file type, and a `val` connects
only to a `val`. One pipeline input may feed several process inputs of the same file type; its own
handle keeps the parameter id of the first input it was connected to, so edge order matters.
Each process input slot takes at most one edge.
