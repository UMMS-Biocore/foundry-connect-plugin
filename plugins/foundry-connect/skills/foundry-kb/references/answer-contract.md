# Answer contract

The labelled blocks, the binding forms and the derived value grammar every KB answer uses. All
paths, ids and values below are made up.

## Numbers

A number about the data or the literature is stated only if a tool result earlier in this
conversation contains it (a job's values table or provenance block, a claim's `quote` or
`effect.magnitude`, a passage you read), or it is a derived value whose every input is such a
number. Each number is followed immediately by one binding in square brackets. A number with no
binding is unbound and counts as unsupported. Numbers that come from the question itself need no
binding. Round only to the precision the source shows, or coarser.

## File locators

- A KB path: `raw/...` relative to the clone root.
- A Foundry report file: `run://<run id>/<report path>`, the path as `get_all_report_paths`
  lists it.
- A workspace job output: `job://<workspace id>/<submission key>/<output path>`.

## Binding forms

| Form | Use |
| --- | --- |
| `[src: <file>#row=<first column value>&col=<column name>]` | one cell |
| `[src: <file>#row=<first column value>]` | a row, when several of its values are quoted |
| `[src: <raw path>#sec=<H2 heading>/<n>]` | a paper paragraph, `n` counting from 1 after that `## ` heading |
| `[claim: <claim id>]` | a claim; the number must appear in its `quote` or `effect.magnitude` |
| `[claim: <claim id>; not checked against the text]` | a claim with `source: metadata_only`; say so in words too |
| `[prov: run=<run id>; file=<report path>; sha256=<first 12 hex>; filter=<filter as returned>; rows_read=<n>; field=<field>]` | a value a job returned as a field of its result, for example `totals.up` |
| `[derived: <expr>; <name>=<value> @ <binding>; ...]` | a value computed from bound inputs |

`<first column value>` is written exactly as the file holds it.

## Derived value grammar

- `<expr>` uses decimal numbers, the names defined in this binding, `+ - * /`, parentheses,
  `abs`, `log2`, `log10`, `min` and `max`. Nothing else: no `count`, `rows`, `sum`, `mean`, no
  table names, no ranges, no conditions.
- Each `<name>=<value> @ <binding>` defines one input exactly once. `<value>` is the number as the
  tool output shows it; `<binding>` is a complete `src`, `claim` or `prov` binding written without
  its brackets. No alias for a path, no shorthand, no nested `derived`.
- The stated number equals `<expr>` over the stated values, rounded no finer than the coarsest
  input.
- A count, a total, a top list or any statistic over a table is not a derived value. Ask a
  workspace job for it and bind it with `prov` or `src: job://...`.

## Filter grammar

The `filter` written into a job and copied into its provenance block reruns as written: clauses
`<column> <op> <value>` joined by `AND`, where `<op>` is one of `< <= > >= == != in` (`in` takes
a bracketed list), plus an optional `top <N> by abs(<column>)`. No `OR`, no nesting, no
expressions over columns. Example: `padj < 0.05 AND baseMean >= 10 top 20 by abs(log2FoldChange)`.

## The blocks

1. **From your data**: values a job returned, bound as above.
2. **From the literature**: statements cited to a passage or a claim.
3. **Synthesis**: your own reasoning, labelled as such, adding no new numbers.
4. **Disagreement**: whenever two analyses, runs or claims on one feature disagree, both sides
   cited; otherwise "None found".

When evidence for a block is missing or unanchored, write that under the block and stop. Never
present a result that is not significant as evidence of no effect.

## Example (made up)

Question: "Is GENEA up in treated cells, and does that match the literature?"

> **From your data**
>
> GENEA has log2FoldChange 1.42 [src: job://ws-0001/sk-7a1/values.csv#row=GENEA&col=log2FoldChange]
> and padj 0.0031 [src: job://ws-0001/sk-7a1/values.csv#row=GENEA&col=padj] in the treated
> versus control comparison. 214 genes pass the filter [prov: run=5001;
> file=DE/TRT_vs_CON.DE.csv; sha256=3f9a0c12b7de; filter=padj < 0.05; rows_read=18342;
> field=totals.rows_kept]. Its fold change is 0.61 higher than in the knockout comparison
> [derived: a - b; a=1.42 @ src: job://ws-0001/sk-7a1/values.csv#row=GENEA&col=log2FoldChange;
> b=0.81 @ src: job://ws-0001/sk-7a2/values.csv#row=GENEA&col=log2FoldChange].
>
> **From the literature**
>
> One study reports GENEA induced after treatment [claim: c-12ab], in a passage that names the
> same cell type [src: raw/library/lit/paper-a.md#sec=Results/3].
>
> **Synthesis**
>
> The run and the paper agree on direction. The paper used a different assay, so the sizes are
> not comparable.
>
> **Disagreement**
>
> None found.
>
> **Provenance**
>
> Workspace ws-0001, submission keys sk-7a1 and sk-7a2. Provenance blocks as returned:
> `{run: "5001", file: DE/TRT_vs_CON.DE.csv, sha256: 3f9a0c12b7de..., filter: "padj < 0.05", rows_read: 18342}`.

An abstaining answer to "what does the literature say about GENEB" writes, under From the
literature: "No paper or claim in this KB discusses GENEB." and nothing more there.
