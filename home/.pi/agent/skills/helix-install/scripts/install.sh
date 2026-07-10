#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <github-url> [forge-args...]" >&2
  exit 2
fi

url="$1"
shift

case "$url" in
  https://github.com/*|http://github.com/*|git@github.com:*) ;;
  *) echo "error: expected a GitHub URL, got: $url" >&2; exit 2 ;;
esac

command -v forge >/dev/null || { echo "error: forge not found" >&2; exit 127; }

forge pkg install --git "$url" --force "$@"
forge list
