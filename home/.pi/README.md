# PI CONFIG (DOTFILES)

This directory is the **source of truth** for your Pi config:
- Repo path: `~/dotfiles/home/.pi`
- Live path: `~/.pi`
- Managed via GNU Stow from your dotfiles repo

## Critical Rules

- **Do not edit `~/.pi` directly.**
- Always make changes in `~/.dotfiles/home/.pi`.
- Assume files here are symlinked into `~/.pi`.
- Keep paths portable (prefer `$HOME`, avoid hardcoded machine-specific paths).

## Validation Checklist (after edits)

- JSON is valid and minimally formatted.
- No secrets were accidentally added to tracked files.
- Paths and references are correct for stowed layout.
- Changes are reflected via symlinked `~/.pi` location.
