Created the global OpenCode V2 plugin at:

```text
home/.config/opencode/plugins/save-md/
```

Usage:

```text
/save-md name
```

It saves the active session’s latest assistant text to `name.md`, excludes reasoning/tools, and refuses overwrites.

Verified:

- TypeScript passes
- 3 tests pass
- Plugin loads successfully
- End-to-end TUI test created the expected Markdown
- Existing-file warning works

Parity: **7 exact, 0 adapted, 0 blocked**.

Note: OpenCode still reports an unrelated pre-existing failure for `herdr-agent-state.js`.
