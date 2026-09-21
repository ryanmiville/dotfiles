---
name: pi-to-opencode-v2-plugin
description: Convert Pi coding-agent extensions into OpenCode V2 plugins while preserving behavior. Use when porting or migrating a Pi extension, its tools, hooks, commands, state, providers, or terminal UI to OpenCode V2.
---

# Pi extension to OpenCode V2 plugin

Port behavior, not syntax. A conversion is complete only when every observable Pi behavior is either reproduced, deliberately adapted with the user's agreement, or explicitly reported as unsupported.

## Sources of truth

Read the extension and every local module, config file, asset, test, and package manifest it depends on.

The installed Pi version is authoritative for the source API:

```text
/Users/ryanmiville/.vite-plus/js_runtime/node/24.15.0/lib/node_modules/@earendil-works/pi-coding-agent/
```

Start with `docs/extensions.md`; read `docs/tui.md`, `docs/custom-provider.md`, `docs/models.md`, `docs/keybindings.md`, `docs/packages.md`, or examples under `examples/extensions/` only when the source reaches those branches. Inspect installed types or implementation when the docs do not settle a semantic detail.

OpenCode V2 documentation is authoritative for the target API. Fetch these current pages rather than relying on remembered shapes:

- Always: <https://opencode.ai/v2/docs/build/plugins> and <https://opencode.ai/v2/docs/plugins>
- Terminal UI, keymaps, dialogs, slots, or rendering: <https://opencode.ai/v2/docs/build/plugins/cli>
- Communication between server and terminal plugins: <https://opencode.ai/v2/docs/build/plugins/rpc>
- Follow links from those pages for the client, API, schemas, or configuration when needed.

Use `@opencode/plugin`, not the V1 `@opencode-ai/plugin` API. Existing V1 plugins and `https://opencode.ai/docs/` are migration input, never V2 API evidence.

## 1. Establish the source boundary

Resolve a named extension in this order: an explicit path, the current project's `.pi/extensions/`, then `~/.pi/agent/extensions/`. Preserve its scope by default: project Pi extension to project OpenCode plugin; global Pi extension to global OpenCode plugin. Ask only when the source or desired scope is ambiguous.

Trace the whole extension, including dynamic imports and files reached through package metadata. Inventory:

- registrations: tools, commands, shortcuts, flags, providers, renderers;
- events and the ordering or cancellation they rely on;
- user-visible output and interaction;
- session, branch, process, location, and durable state;
- spawned processes, sockets, timers, watchers, and cleanup;
- environment variables, external programs, config, assets, and dependencies;
- behavior that differs between TUI, RPC, print, or headless use.

Run or inspect the Pi extension enough to capture its baseline when practical. This step is complete when every imported behavior and side effect belongs to the inventory.

## 2. Build the parity ledger

Before implementation, create a **parity ledger** with one row per observable behavior:

| Behavior | Pi trigger/API | Observable contract | State/lifetime | OpenCode target | Status | Verification |
|---|---|---|---|---|---|---|

Use exactly these statuses:

- `exact` — V2 can preserve the contract;
- `adapted` — the user-facing result can be preserved through a different interaction;
- `blocked` — no supported V2 seam preserves the behavior.

Treat ordering, cancellation, persistence, branching, reload, and headless behavior as part of the contract. A similarly named hook is not proof of parity.

Use this only as a discovery map, then confirm the current signatures and semantics in the V2 docs:

| Pi concept | Candidate OpenCode V2 seam |
|---|---|
| `registerTool` | server `ctx.tool.transform` |
| `tool_call` / `tool_result` | server tool hooks; permission hook or a wrapped tool when blocking semantics are required |
| `before_agent_start`, `context`, provider events | session prompt/context/model/HTTP hooks |
| `registerCommand` | server command transform, CLI keymap/slash command, or both, depending on where it must work |
| `registerProvider` / model changes | provider or model transforms |
| extension/session state | server `ctx.storage`, CLI storage, or explicit session data according to lifetime |
| dialogs, notifications, shortcuts, widgets, footer, custom rendering | CLI plugin dialogs, attention, keymaps, slots, routes, or Markdown renderers |
| cross-process UI plus server behavior | server plugin + CLI plugin joined by typed RPC |

Do not start coding while a row lacks a target or a `blocked` decision. Ask the user before accepting blocked behavior or a materially different workflow; continue autonomously for implementation-only differences.

## 3. Choose the plugin topology

Choose by execution boundary:

- **Server plugin** for model-visible tools, session hooks, permissions, provider/model transforms, commands that must work outside the terminal, and location-scoped durable behavior.
- **CLI plugin** for dialogs, toasts, routes, slots, Markdown rendering, keybindings, and terminal-local state.
- **Split plugin** when one Pi extension combines both. Expose only the required server operations and events through a typed RPC definition; remember that the server and terminal are separate processes and may reconnect.

A one-file Pi extension does not imply a one-file OpenCode plugin. Follow the current loading docs for local versus packaged server and CLI entrypoints; do not assume a file discovered as a server plugin is also loaded by the terminal.

This step is complete when every parity-ledger row has one owning entrypoint and any cross-process protocol is defined.

## 4. Implement the semantic port

Keep domain logic pure where possible and replace the Pi-facing adapter around it.

- Define V2 entrypoints with `Plugin.define` from the documented package entrypoint.
- Register transforms and hooks during `setup`. Keep transforms synchronous, cheap, deterministic, and replay-safe.
- Return cleanup for owned listeners, subscriptions, timers, watchers, child processes, and sockets. Make cleanup idempotent.
- Propagate the provided `AbortSignal` through fetches, subprocesses, and long-running work.
- Derive project paths from the plugin location or operation context; do not substitute the converter's current working directory for Pi's `ctx.cwd` without checking semantics.
- Match state storage to its ledger lifetime. Do not collapse branch- or session-aware Pi state into process globals.
- Convert TypeBox or inferred schemas to the schema format accepted by the selected V2 API, retaining required fields, bounds, enums, descriptions, and `additionalProperties` behavior.
- Preserve tool names, command names, output meaning, errors, and progress where compatible. Record intentional naming changes in the ledger.
- Use typed RPC for server/CLI communication. Design reconnect and missed-event behavior instead of assuming an in-process event bus.
- Add dependencies and loading configuration in the narrowest existing manifest/config. Preserve unrelated settings and use the documented V2 package name.
- Leave the Pi source intact unless the user explicitly asks to remove it.

When no supported V2 seam exists, stop that branch at the smallest boundary. Keep the portable core, document the blocked adapter, and avoid private OpenCode internals unless the user explicitly accepts that maintenance risk.

Implementation is complete when every non-blocked ledger row has code and every acquired resource has a release path.

## 5. Prove parity

Verify from the inside out:

1. Run focused tests for extracted domain logic and schema validation.
2. Run the repository's formatter, typecheck, lint, and tests that cover modified files.
3. Load the plugin through the documented V2 mechanism and confirm its ID and entrypoints activate without startup errors. Inspect OpenCode logs for load or cleanup failures.
4. Exercise every parity-ledger row through its real boundary: model tool call, session hook, command, reload, restart, or terminal interaction. Use a real PTY for CLI behavior.
5. Test cancellation and unload/reload for long-lived work. Test multiple sessions or locations when state isolation matters.
6. Compare actual results with the Pi baseline, including failure paths and headless behavior.

Do not infer runtime success from compilation. This step is complete only when every `exact` or `adapted` row contains concrete passing evidence and every `blocked` row states the missing V2 seam and user impact.

## Completion report

Report:

- created or modified paths and how the plugin is loaded;
- parity-ledger totals for `exact`, `adapted`, and `blocked`;
- verification commands and observed results;
- user decisions, remaining gaps, and any manual activation step.

Never call the conversion complete while an inventory behavior is absent from the ledger.
