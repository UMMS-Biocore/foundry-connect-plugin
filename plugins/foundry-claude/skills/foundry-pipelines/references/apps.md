# Discover & launch apps

Purpose: find interactive ViaFoundry apps (RStudio, JupyterLab, CellxGene, IGV, etc.) and launch
one, returning a link the user can open.

## Tools

| Tool | Read/Write | Usage |
| --- | --- | --- |
| `list_apps(search)` | Read | List available applications — ID, name, description, image/config. Pass `search` to filter by name. Use this first to find an app's ID. |
| `discover_app_endpoints(search, as_json)` | Read | Advanced/debugging: search ViaFoundry's API endpoints by name, description, or path. Prefer `list_apps` for the common case of finding an app by name; reach for this only when `list_apps` doesn't surface what's needed. |
| `launch_app(app_id, run_type, parameters)` | **Write/execute — confirm first** | Starts the app (launches compute/a session on the ViaFoundry backend). `run_type` defaults to `"standalone"`. Confirm with a one-line summary — e.g. *"I'll launch CellxGene now — proceed?"* — before calling. |

## Returning the link

On a successful `launch_app` call, return the app's link to the user in chat. The exact field name
in the JSON response that carries the shareable/access URL has **not been verified against the
live tool yet** — treat this as unconfirmed. In practice:

- Inspect the returned JSON for a URL-shaped field (something containing `url`, `link`, `route`,
  or similar).
- If one is clearly present, surface it directly as the app's link.
- If the response doesn't obviously contain one, tell the user the app was launched successfully
  and point them to the ViaFoundry Apps page to open it, rather than guessing at a field name.

## Worked example

**"Launch CellxGene"**
→ `list_apps(search="CellxGene")` → find its `app_id`.
→ confirm: *"I'll launch CellxGene now — proceed?"*
→ `launch_app(app_id="<id>")` → return the launched app's link (or launch confirmation, per
above) in chat.
