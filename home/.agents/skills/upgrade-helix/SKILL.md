---
name: upgrade-helix
description: Rebuilds the Helix editor from the head of the Steel plugin-system PR (helix-editor/helix#8675) in ~/.local/src/helix-pr-8675. Use when the user asks to upgrade, update, reinstall, or rebuild Helix, or to pull the latest commits from the plugins/Steel PR. Not for installing Steel plugins — use helix-install for that.
---

# Upgrade Helix

Rebuilds `hx` from the latest commit on PR #8675 (the Steel plugin system).

## Quick start

```bash
# Is there anything new?
~/.agents/skills/upgrade-helix/scripts/upgrade.sh --check

# Fetch the PR head and rebuild
~/.agents/skills/upgrade-helix/scripts/upgrade.sh
```

The script is a no-op when already at the remote PR head.

## Options

| Flag | Effect |
|---|---|
| `--check` | Print local vs remote PR head, exit without building. |
| `--update-steel` | Also `cargo update -p steel-core`. Needed to pick up newer Steel; also the most likely cause of a broken build. |
| `--bump-tooling` | Reinstall `steel`/`forge`/`steel-language-server` to match. Implies `--update-steel`. |
| `--force` | Rebuild even when already current. |

Env overrides: `HELIX_SRC_DIR`, `HELIX_PR`.

## Workflow

1. Run with `--check` and report whether an update exists.
2. If the user only wants newer Steel (not new PR commits), use `--update-steel`.
3. Run the script. A release build takes several minutes — do not assume it hung.
4. On success report the built commit and the rollback command the script prints.
5. If it warns about Steel version skew, offer `--bump-tooling`.

## How the install works

- Source: `~/.local/src/helix-pr-8675`, remote is upstream `helix-editor/helix`.
- `~/.cargo/bin/hx` is a **wrapper script**, not a symlink. It execs
  `$HELIX_DIR/target/release/hx` and exports `HELIX_RUNTIME`.
- So finishing the build swaps the binary in place — there is **no install step**.
  Never `cargo install` Helix; it is deliberately not in `~/.cargo/.crates.toml`.
- `steel` is in `helix-term`'s default features, so plain `cargo build --release`
  is correct; no `--features steel`.
- `rust-toolchain.toml` pins the compiler, so rustup selects it automatically.
- Ignore `.envrc` — it wants nix/direnv, which are not installed.

## Rules

- The PR ref must be fetched explicitly as `pull/8675/head`; `origin` uses a
  plain `refs/heads/*` refspec, so `git pull` will never see PR commits.
- Refuse to build with a dirty working tree; the script enforces this.
- Do not edit `~/.config/helix` directly — edit `~/dotfiles/home/.config/helix`.
- Do not set `HELIX_RUNTIME`; the wrapper handles it.
- Old binaries are not archived. Rollback = check out the previous commit and rebuild.
