---
name: helix-install
description: Installs Helix Steel plugins from GitHub URLs. Use only when explicitly invoked by the user with /skill:helix-install; hidden from automatic skill selection.
disable-model-invocation: true
---

# Helix Install

Install a Helix Steel plugin from a GitHub URL.

## Workflow

1. Extract the GitHub URL from the user args; fail if missing.
2. Run:
   ```bash
   ./scripts/install.sh <github-url>
   ```
3. Read the plugin README from `~/.local/share/steel/cog-sources/<repo>/` if present.
4. If README has Helix usage code, update `~/dotfiles/home/.config/helix/init.scm` idempotently.
5. Validate with:
   ```bash
   hx --health clipboard
   ```
6. Report installed package name, files changed, and any manual usage note.

## Rules

- Do not edit `~/.config/helix` directly; edit dotfiles path.
- Do not set `HELIX_RUNTIME`; `hx` wrapper handles it.
- Use `forge pkg install --git ... --force` so installed plugins update cleanly.
