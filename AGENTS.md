# DOTFILES KNOWLEDGE BASE

**Generated:** 2026-01-23
**Commit:** 0ae6225
**Branch:** main

## OVERVIEW

macOS dev environment managed by `dot` CLI using GNU Stow. Single `home/` package symlinks to `$HOME`.

## STRUCTURE

```
dotfiles/
├── dot              # Main CLI (~1900 lines bash)
├── home/            # Stow package → $HOME
│   ├── .zshrc       # Shell config (zinit)
│   ├── .config/     # XDG configs (nvim, tmux, zed, nushell, etc.)
│   ├── .claude/     # AI skills/agents (symlinked by opencode)
│   └── .local/bin/  # User scripts
├── packages/        # Brewfiles
│   └── bundle       # Base packages
└── backups/         # Auto-created on stow conflicts
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/remove packages | `dot package add/remove` | Auto-detects brew vs cask |
| Edit tool config | `home/.config/<tool>/` | Stow mirrors $HOME |
| Shell customization | `home/.zshrc` | Zinit plugin manager |
| Neovim plugins | `home/.config/nvim/lua/plugins/` | One file per plugin |
| AI agents/skills | `home/.claude/` | OpenCode reads via symlink |
| System health | `dot doctor` | Diagnoses common issues |

## CONVENTIONS

- **Monolithic stow**: Single `home/` package (not per-tool packages)
- **XDG compliant**: All configs under `.config/`
- **Commit messages**: Extremely terse, sacrifice grammar (e.g., `nvim tweaks`, `add ghostty`)
- **No bundle.work**: README mentions it but doesn't exist yet

## ANTI-PATTERNS

- **Never** manually edit `lazy-lock.json` - lazy.nvim manages it
- **Never** add files to `backups/` - auto-created by stow
- **Never** stow individual dirs - always `dot stow` (uses `home/` package)

## COMMANDS

```bash
dot init              # Full setup: brew, packages, stow, bun, opencode, ssh
dot update            # Pull, upgrade packages, re-stow
dot doctor            # Health check
dot stow              # Re-symlink home/ → $HOME
dot package add X     # Install + register in Brewfile
dot package list      # Show all registered packages
dot summary -n 5      # AI summary of last 5 commits
```

## NOTES

- Stow backs up existing files to `backups/<timestamp>/` before overwriting
- `dot` script is self-contained bash - no external deps for core functions
- OpenCode config at `home/.config/opencode/` symlinks to `home/.claude/agents/`
