---
name: screen-capture
description: Captures macOS screenshots and fixed-duration screen recordings to deterministic paths, including specific windows, displays, regions, and Herdr activity. Use when a user asks an agent to screenshot, record, document, demonstrate, or produce visual evidence of work on macOS.
disable-model-invocation: true
compatibility: Requires macOS, /usr/sbin/screencapture, and a Swift toolchain. The agent's host terminal must have Screen Recording permission.
---

# Screen Capture

Create attributable artifacts with the bundled script. Do not use CleanShot, infer newly created files, or overwrite an existing artifact.

## Capture

Resolve the script relative to this skill directory, then use one target:

```bash
scripts/capture.sh screenshot --target window
scripts/capture.sh screenshot --target window --app Ghostty
scripts/capture.sh screenshot --target main
scripts/capture.sh screenshot --target display --display 2
scripts/capture.sh screenshot --target region --region 100,120,800,600
scripts/capture.sh record --target window --duration 10
```

The default output is a unique file under `$PWD/artifacts/`. The script prints only its absolute path to stdout. Pass an exact destination when needed:

```bash
scripts/capture.sh screenshot --target window --output /absolute/path/evidence.png
scripts/capture.sh record --target main --duration 15 --output /absolute/path/demo.mov
```

Recording duration is required and expressed in whole seconds. Microphone capture is off. If explicitly requested, native `screencapture` supports `-g`, but the helper intentionally does not yet expose audio.

## Workflow

1. Decide screenshot versus recording, target, duration, and output path.
2. For `window`, ensure the intended application is frontmost or pass `--app`.
3. Run the helper. Never launch two captures targeting the same output.
4. Treat exit success as capture completion; the helper verifies a nonempty file and media type.
5. Report the exact path, dimensions/duration when available, and what was captured.

If permission is missing, tell the user to enable the agent's host application under **System Settings → Privacy & Security → Screen & System Audio Recording**, then quit and reopen that host. Stop until they do so.

## Herdr recordings

When the user explicitly requests Herdr, load and follow the Herdr skill first. Preserve IDs returned by Herdr and never predict them.

1. Record the original tab ID and discover the current Ghostty window while it is frontmost.
2. Create the requested tab with `--no-focus`; retain its returned tab and pane IDs.
3. Start `capture.sh record --target window --app Ghostty ...` in the background.
4. Wait one second, focus the created tab, then run the demonstration commands.
5. Wait for the capture process, restore the original tab, and verify the video.
6. Leave created tabs open unless the user asks to close them.

Example shape:

```bash
scripts/capture.sh record --target window --app Ghostty --duration 12 \
  --output "$PWD/artifacts/herdr-demo.mov" & capture_pid=$!
sleep 1
herdr tab focus "$demo_tab"
herdr pane run "$demo_pane" 'the demonstration command'
wait "$capture_pid"
herdr tab focus "$original_tab"
```

Do not claim the recording shows the intended activity without checking the target pane's output and the resulting file.

## Failure handling

- Exit 77: permission missing; follow the permission workflow above.
- No matching window: focus the app, disambiguate `--app`, and retry once.
- Existing output: choose another path; never delete it silently.
- Capture process failure or invalid media: preserve diagnostics and report failure, not a path.
