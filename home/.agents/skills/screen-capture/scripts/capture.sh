#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  capture.sh screenshot --target window|main|display|region [options]
  capture.sh record --target window|main|display|region --duration SECONDS [options]

Options:
  --app NAME           Window target application; defaults to frontmost app
  --display NUMBER     Required by display target
  --region X,Y,W,H     Required by region target
  --duration SECONDS   Required for recordings; positive whole number
  --output ABSOLUTE    Exact .png or .mov destination; must not exist
EOF
  exit 2
}

fail() {
  printf 'screen-capture: %s\n' "$*" >&2
  exit 1
}

[[ $# -ge 1 ]] || usage
kind=$1
shift
[[ "$kind" == "screenshot" || "$kind" == "record" ]] || usage

target=""
app=""
display=""
region=""
duration=""
output=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      [[ $# -ge 2 ]] || usage
      target=$2
      shift 2
      ;;
    --app)
      [[ $# -ge 2 ]] || usage
      app=$2
      shift 2
      ;;
    --display)
      [[ $# -ge 2 ]] || usage
      display=$2
      shift 2
      ;;
    --region)
      [[ $# -ge 2 ]] || usage
      region=$2
      shift 2
      ;;
    --duration)
      [[ $# -ge 2 ]] || usage
      duration=$2
      shift 2
      ;;
    --output)
      [[ $# -ge 2 ]] || usage
      output=$2
      shift 2
      ;;
    *) usage ;;
  esac
done

case "$target" in
  window|main|display|region) ;;
  *) fail "--target must be window, main, display, or region" ;;
esac

if [[ "$kind" == "record" ]]; then
  [[ "$duration" =~ ^[1-9][0-9]*$ ]] || fail "recording requires --duration as positive whole seconds"
else
  [[ -z "$duration" ]] || fail "--duration is valid only for recordings"
fi

[[ -z "$app" || "$target" == "window" ]] || fail "--app is valid only for a window target"
if [[ "$target" == "display" ]]; then
  [[ "$display" =~ ^[1-9][0-9]*$ ]] || fail "display target requires --display as a positive number"
else
  [[ -z "$display" ]] || fail "--display is valid only for a display target"
fi

if [[ "$target" == "region" ]]; then
  [[ "$region" =~ ^-?[0-9]+,-?[0-9]+,[1-9][0-9]*,[1-9][0-9]*$ ]] || \
    fail "region target requires --region X,Y,W,H with positive width and height"
else
  [[ -z "$region" ]] || fail "--region is valid only for a region target"
fi

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
"$script_dir/front-window-id.swift" --check

extension=png
[[ "$kind" == "record" ]] && extension=mov

if [[ -z "$output" ]]; then
  artifact_dir="$PWD/artifacts"
  mkdir -p -- "$artifact_dir"
  timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
  output="$artifact_dir/${kind}-${target}-${timestamp}-$$.${extension}"
else
  [[ "$output" == /* ]] || fail "--output must be an absolute path"
  [[ "$output" == *."$extension" ]] || fail "$kind output must use .$extension extension"
  mkdir -p -- "$(dirname -- "$output")"
fi

[[ ! -e "$output" ]] || fail "output already exists: $output"

arguments=(-x)
if [[ "$kind" == "record" ]]; then
  arguments+=(-v -V "$duration")
fi

case "$target" in
  window)
    if [[ -n "$app" ]]; then
      window_id=$("$script_dir/front-window-id.swift" --app "$app")
    else
      window_id=$("$script_dir/front-window-id.swift")
    fi
    [[ "$window_id" =~ ^[0-9]+$ ]] || fail "window discovery returned an invalid ID"
    arguments+=(-l "$window_id")
    ;;
  main)
    arguments+=(-D 1)
    ;;
  display)
    arguments+=(-D "$display")
    ;;
  region)
    arguments+=(-R "$region")
    ;;
esac

if ! /usr/sbin/screencapture "${arguments[@]}" "$output"; then
  rm -f -- "$output"
  fail "native capture failed"
fi

[[ -s "$output" ]] || {
  rm -f -- "$output"
  fail "capture produced no data"
}

media_type=$(/usr/bin/file -b --mime-type -- "$output")
case "$kind:$media_type" in
  screenshot:image/png|record:video/quicktime) ;;
  *)
    rm -f -- "$output"
    fail "capture produced unexpected media type: $media_type"
    ;;
esac

printf '%s\n' "$output"
