# Pipeline graph format

How Foundry Connect stores a pipeline graph, as its web editor saves it. Read this when a spec
will not plan, when an edge looks wrong in the editor, or when you need to reason about a saved
pipeline from `get_pipeline`. The MCP pipeline tools write all of this for you.

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

- `param` is a **process id** (string), `inPro` for a pipeline input, `outPro` for a pipeline
  output, or `p<pipelineId>` for a module (see Modules below).
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

## Modules

A pipeline can hold another pipeline as a **module** node. Its `param` is `p` followed by the
module pipeline's id, for example `"param": "p1776"`. The id is that exact revision; the module does
not move to a newer revision on its own.

### Ports

A module's ports come from the module pipeline's own graph:

- **Inputs:** one per distinct inner process input end that a pipeline input (`inPro`) edge
  reaches, in the order those ends first appear in the module pipeline's edges.
- **Outputs:** one per pipeline output (`outPro`) edge, in stored order.
- A port's **name** is the module pipeline's own input or output node name. Its **type** is the
  file type and qualifier of the inner parameter it reaches: the consuming process input for an
  input port, the producing process output for an output port. Because one inner input node can
  feed several steps, two input ports can share a name; tell them apart by slot.

`get_pipeline_ports(pipeline_id)` lists exactly these, with `slot`, `name`, `process_id`,
`parameter_id`, `file_type` and `qualifier`.

### Edge handles

A module end names the inner process slot it stands for, not the module pipeline:

```
pi-{innerProcessId}-{order}-{innerParameterId}-{N}     module input port
po-{innerProcessId}-{order}-{innerParameterId}-{N}     module output port
```

`innerProcessId`, `order` and `innerParameterId` identify the inner process parameter behind the
port (`order` is its 0-based position on that inner process), and `N` is the number in the module
node's own key `g-N` in the outer pipeline. The MCP tools write these for you; connections in a spec
only need the module key and a port slot or name.

### Limits

- Modules nest at most 5 levels deep.
- A pipeline may not contain itself or any revision of itself; `update_pipeline` refuses it.
- Pick the revision on purpose with `list_pipeline_revisions`, since the module stays pinned to it.

### Worked example

A pipeline that trims reads with one process and then hands them to an existing alignment pipeline
as a module. The ids are examples. First read the module's ports:

```json
get_pipeline_ports(1776)
{"inputs":  [{"slot": 0, "name": "reads",  "process_id": 2410, "parameter_id": 639, "file_type": "fastq", "qualifier": "set"},
             {"slot": 1, "name": "genome", "process_id": 2410, "parameter_id": 812, "file_type": "fasta", "qualifier": "file"}],
 "outputs": [{"slot": 0, "name": "aligned_bam", "process_id": 2411, "parameter_id": 164, "file_type": "bam",  "qualifier": "set"},
             {"slot": 1, "name": "align_report", "process_id": 2412, "parameter_id": 201, "file_type": "html", "qualifier": "file"}]}
```

Then write the spec. The trimming process's output is a `fastq` set, so it may feed the module's
`reads` port:

```json
{
  "name": "Trim and align",
  "pipeline_group_id": 667,
  "processes": [{"key": "trim", "process_id": 2357}],
  "modules":   [{"key": "align", "pipeline_id": 1776, "name": "Alignment"}],
  "inputs":    [{"key": "reads"}, {"key": "genome"}],
  "outputs":   [{"key": "Aligned_BAM"}, {"key": "Alignment_Report", "publish": "html"}],
  "connections": [
    {"from": "reads",  "to": "trim"},
    {"from": "trim",   "to": "align", "input": "reads"},
    {"from": "genome", "to": "align", "input": 1},
    {"from": "align",  "output": "aligned_bam", "to": "Aligned_BAM"},
    {"from": "align",  "output": 1,             "to": "Alignment_Report"}
  ]
}
```

`create_pipeline_config` with this spec reads the module's ports from the server and refuses a
connection whose ends differ in file type, just as it does for a process. After it is created,
`get_pipeline` lists the module under `modules` as `{"node": "align", "pipeline_id": 1776}` and
names its ports in `connections`.
