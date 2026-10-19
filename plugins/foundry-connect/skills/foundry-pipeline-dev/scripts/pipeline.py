#!/usr/bin/env python3
"""Show, plan, create or update a Foundry Connect pipeline from a JSON spec.

    pipeline.py revisions <pipeline_id>         list every revision (each has its own id) and its version
    pipeline.py process <process_id>            list a process's input and output slots with their types
    pipeline.py show <pipeline_id>              print a saved pipeline as a spec
    pipeline.py plan <spec.json>                build and type-check the graph; no server write
    pipeline.py create <spec.json>              create a new pipeline (private unless the spec says otherwise)
    pipeline.py update <pipeline_id> <spec.json>  save the spec's graph over an existing pipeline

plan, create and update read processes from the server to learn their slots
and types, so a wrong connection fails before anything is written. Sign-in
comes from the SDK's own config (run `foundry configure` once); this script
never reads or prints a credential.

Run it with the SDK available, for example:
    uv run --with git+https://github.com/UMMS-Biocore/foundry-sdk python pipeline.py plan spec.json
"""
import argparse
import json
import sys

try:
    from viafoundry.client import ViaFoundryClient
    from viafoundry.pipelines import INPUT_NODE, OUTPUT_NODE, PipelineGraphError, parse_edge
except ImportError:
    sys.exit("The Foundry SDK with pipeline support is not installed: "
             "uv run --with git+https://github.com/UMMS-Biocore/foundry-sdk python pipeline.py ...")


def build(pipelines, spec):
    """Turn a spec into a builder. Node labels in the spec map to g-N keys."""
    b = pipelines.builder()
    keys = {}
    for label, pid in spec.get("processes", {}).items():
        keys[label] = b.add_process(pid, name=label)
    for label, opts in spec.get("inputs", {}).items():
        keys[label] = b.add_input((opts or {}).get("name", label))
    for label, opts in spec.get("outputs", {}).items():
        opts = opts or {}
        keys[label] = b.add_output(opts.get("name", label), publish=opts.get("publish"))
    for i, edge in enumerate(spec.get("edges", [])):
        for end in ("from", "to"):
            if edge.get(end) not in keys:
                raise PipelineGraphError(f"edge {i}: no node labelled {edge.get(end)!r}")
        b.connect(keys[edge["from"]], keys[edge["to"]], output=edge.get("output"), input=edge.get("input"))
    return b, keys


def describe(b, keys):
    label = {v: k for k, v in keys.items()}
    lines = []
    for key, node in b.nodes.items():
        kind = {INPUT_NODE: "input", OUTPUT_NODE: "output"}.get(node["param"], f"process {node['param']}")
        lines.append(f"  {key:5s} {label.get(key, node['nodeName'])!s:24s} {kind}")
    lines.append("edges:")
    for edge in b.edges:
        src, dst = parse_edge(edge)
        s, d = b.nodes[src["node"]], b.nodes[dst["node"]]
        s_slot = "" if s["param"] == INPUT_NODE else f".out{src['slot']}"
        d_slot = "" if d["param"] == OUTPUT_NODE else f".in{dst['slot']}"
        lines.append(f"  {label.get(src['node'], s['nodeName'])}{s_slot} -> {label.get(dst['node'], d['nodeName'])}{d_slot}")
    return "\n".join(lines)


def show(pipelines, pipeline_id):
    """A saved pipeline as a spec that plan/create can read back."""
    p = pipelines.get_pipeline(pipeline_id)
    label = {}
    spec = {"name": p.get("name"), "pipeline_group_id": p.get("pipeline_group_id"),
            "summary": p.get("summary") or "", "processes": {}, "inputs": {}, "outputs": {}, "edges": []}
    for key, node in p["nodes"].items():
        name = node["nodeName"]
        while name in label.values():
            name += "_"
        label[key] = name
        opts = {"name": node["nodeName"]} if name != node["nodeName"] else {}
        if node["param"] == INPUT_NODE:
            spec["inputs"][name] = opts
        elif node["param"] == OUTPUT_NODE:
            pub = (node.get("nodeSettings") or {}).get("pubWeb")
            spec["outputs"][name] = {**opts, "publish": pub} if pub else opts
        else:
            spec["processes"][name] = int(node["param"])
    # A pipeline input keeps the parameter id of the first input it was wired to,
    # so list the edge that matches it first; saved order does not guarantee that.
    ordered = sorted(p["edges"], key=lambda e: (lambda s, d: s["param"] == INPUT_NODE and s["parameterId"] != d["parameterId"])(*parse_edge(e)))
    for edge in ordered:
        src, dst = parse_edge(edge)
        e = {"from": label[src["node"]], "to": label[dst["node"]]}
        if src["param"] != INPUT_NODE:
            e["output"] = src["slot"]
        if dst["param"] != OUTPUT_NODE:
            e["input"] = dst["slot"]
        spec["edges"].append(e)
    return spec


def revisions(client, pipeline_id):
    rows = client.call("GET", f"/api/pipeline/v1/{pipeline_id}/revisions").get("data", [])
    return "\n".join(f"  pipeline {r.get('id')}  version {r.get('version')}" for r in rows)


def slots(client, process_id):
    p = client.call("GET", f"/api/v1/process/{process_id}")
    lines = [f"process {process_id}: {p.get('name')}"]
    for kind in ("inputs", "outputs"):
        for i, x in enumerate(p.get(kind) or []):
            lines.append(f"  {kind[:-1]:6s} {i}  {x.get('name')!s:16s} {x.get('qualifier')!s:4s} {x.get('file_type')!s:12s} "
                         f"parameter {x.get('parameter_id')}  sname {x.get('sname')}")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["revisions", "process", "show", "plan", "create", "update"])
    ap.add_argument("args", nargs="+")
    a = ap.parse_args()
    client = ViaFoundryClient()
    pipelines = client.pipelines

    if a.command == "revisions":
        print(revisions(client, int(a.args[0])))
        return
    if a.command == "process":
        print(slots(client, int(a.args[0])))
        return
    if a.command == "show":
        print(json.dumps(show(pipelines, int(a.args[0])), indent=2))
        return

    pipeline_id = int(a.args[0]) if a.command == "update" else None
    spec = json.load(open(a.args[-1]))
    try:
        b, keys = build(pipelines, spec)
    except PipelineGraphError as e:
        sys.exit(f"Graph refused: {e}")
    print(describe(b, keys))

    if a.command == "plan":
        print("\nPlan only; nothing was written.")
    elif a.command == "create":
        if not spec.get("pipeline_group_id"):
            sys.exit("The spec needs pipeline_group_id (a pipeline menu group, not a process menu group).")
        created = pipelines.create_pipeline(
            spec["name"], spec["pipeline_group_id"], nodes=b.nodes, edges=b.edges,
            summary=spec.get("summary", ""), permission=spec.get("permission", 3),
        )
        print(f"\nCreated pipeline {created.get('id')}.")
    else:
        pipelines.update_pipeline(pipeline_id, nodes=b.nodes, edges=b.edges)
        print(f"\nSaved the graph over pipeline {pipeline_id}.")


if __name__ == "__main__":
    main()
