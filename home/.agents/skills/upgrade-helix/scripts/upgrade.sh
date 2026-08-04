#!/usr/bin/env bash
set -euo pipefail

HELIX_DIR="${HELIX_SRC_DIR:-$HOME/.local/src/helix-pr-8675}"
PR_NUM="${HELIX_PR:-8675}"
STEEL_GIT="https://github.com/mattwparas/steel.git"

update_steel=0
bump_tooling=0
force=0
check_only=0

usage() {
  cat >&2 <<EOF
usage: $0 [options]

Rebuilds Helix from the head of PR #$PR_NUM in $HELIX_DIR.

options:
  --check          Report local vs remote PR head, then exit.
  --update-steel   Also 'cargo update -p steel-core' (floats to newest steel).
  --bump-tooling   Reinstall steel/forge/LSP CLIs to match. Implies --update-steel.
  --force          Rebuild even when already at the remote PR head.
  -h, --help       Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)        check_only=1 ;;
    --update-steel) update_steel=1 ;;
    --bump-tooling) bump_tooling=1; update_steel=1 ;;
    --force)        force=1 ;;
    -h|--help)      usage; exit 0 ;;
    *) echo "error: unknown option: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

[[ -d "$HELIX_DIR/.git" ]] || { echo "error: no git repo at $HELIX_DIR" >&2; exit 1; }
command -v cargo >/dev/null || { echo "error: cargo not found" >&2; exit 127; }

cd "$HELIX_DIR"

# The 'hx' on PATH must be the wrapper pointing into this tree, otherwise a
# successful build would not actually change the binary the user runs.
wrapper="$(command -v hx || true)"
if [[ -n "$wrapper" && -f "$wrapper" ]]; then
  # The wrapper stores the path unexpanded as "$HOME/...", so check both forms.
  unexpanded="\$HOME/${HELIX_DIR#"$HOME"/}"
  if ! grep -qF -e "$HELIX_DIR" -e "$unexpanded" "$wrapper"; then
    echo "warning: $wrapper does not reference $HELIX_DIR" >&2
    echo "         building here may not change the 'hx' you run." >&2
  fi
fi

say "Checking PR #$PR_NUM head"
remote_head="$(git ls-remote origin "refs/pull/$PR_NUM/head" | cut -f1)"
[[ -n "$remote_head" ]] || { echo "error: could not read PR #$PR_NUM head" >&2; exit 1; }
local_head="$(git rev-parse HEAD)"
echo "  remote: $remote_head"
echo "  local:  $local_head"

if [[ "$check_only" == 1 ]]; then
  [[ "$remote_head" == "$local_head" ]] && echo "  up to date" || echo "  update available"
  exit 0
fi

if [[ "$remote_head" == "$local_head" && "$force" == 0 && "$update_steel" == 0 ]]; then
  echo "  already up to date; nothing to do (use --force or --update-steel)"
  exit 0
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is dirty; commit or stash first" >&2
  git status --short >&2
  exit 1
fi

prev_head="$local_head"

if [[ "$remote_head" != "$local_head" ]]; then
  branch="pr-$PR_NUM-$(date +%Y%m%d%H%M)"
  say "Fetching PR #$PR_NUM into $branch"
  # origin is upstream helix-editor/helix with a refs/heads/* refspec, so the
  # PR ref has to be named explicitly; a plain 'git pull' will never see it.
  git fetch origin "pull/$PR_NUM/head:$branch"
  git checkout "$branch"

  say "Changes since previous build"
  git log --oneline "$prev_head..HEAD" || true
fi

if [[ "$update_steel" == 1 ]]; then
  say "Updating steel-core"
  # steel-core is an unpinned git dep; Cargo.lock is the only thing holding it.
  cargo update -p steel-core
fi

say "Building (release)"
# steel is already in helix-term's default features; no --features flag needed.
cargo build --release

say "Fetching and building grammars"
hx --grammar fetch
hx --grammar build

if [[ "$bump_tooling" == 1 ]]; then
  say "Realigning steel CLI tooling"
  cargo install --git "$STEEL_GIT" --force \
    steel-interpreter steel-forge steel-language-server cargo-steel-lib
fi

say "Verifying"
hx --version
hx --health clipboard || true

lock_rev="$(grep -A2 'name = "steel-core"' Cargo.lock | grep -o 'steel.git#[a-f0-9]*' | cut -d'#' -f2 || true)"
tool_rev="$(grep -o 'steel.git#[a-f0-9]*' "$HOME/.cargo/.crates.toml" 2>/dev/null | cut -d'#' -f2 | sort -u | head -1 || true)"
if [[ -n "$lock_rev" && -n "$tool_rev" && "$lock_rev" != "$tool_rev" ]]; then
  echo
  echo "note: steel version skew"
  echo "  hx compiled against: $lock_rev"
  echo "  steel/forge CLIs:    $tool_rev"
  echo "  run with --bump-tooling to realign"
fi

say "Done"
echo "  built:    $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)"
echo "  rollback: cd $HELIX_DIR && git checkout ${prev_head:0:12} && cargo build --release"
