#!/usr/bin/env bun
/**
 * Creates a standalone git repo for the cost-guardrails opencode plugin.
 *
 * Usage:
 *   bun setup-cost-guardrails-repo.ts [dest]
 *
 * Default dest: ~/dev/opencode-cost-guardrails
 */
import fs from "fs";
import path from "path";
import os from "os";
import { $ } from "bun";

const dest =
  process.argv[2] ?? path.join(os.homedir(), "dev", "opencode-cost-guardrails");

if (fs.existsSync(dest)) {
  console.error(`Directory already exists: ${dest}`);
  process.exit(1);
}

const here = path.dirname(import.meta.path);
const pluginSrc = path.resolve(here, "../plugins/cost-guardrails.ts");

if (!fs.existsSync(pluginSrc)) {
  console.error(`Plugin not found: ${pluginSrc}`);
  process.exit(1);
}

console.log(`Creating repo at ${dest}`);

fs.mkdirSync(path.join(dest, "plugins"), { recursive: true });
fs.mkdirSync(path.join(dest, "scripts"), { recursive: true });

// Copy source files
fs.copyFileSync(pluginSrc, path.join(dest, "plugins", "cost-guardrails.ts"));
fs.copyFileSync(
  path.join(here, "cost-guardrails-replay.ts"),
  path.join(dest, "scripts", "cost-guardrails-replay.ts"),
);
fs.copyFileSync(
  path.join(here, "cost-guardrails-status.ts"),
  path.join(dest, "scripts", "cost-guardrails-status.ts"),
);

// package.json
fs.writeFileSync(
  path.join(dest, "package.json"),
  JSON.stringify(
    {
      name: "opencode-cost-guardrails",
      version: "0.1.0",
      module: "plugins/cost-guardrails.ts",
      type: "module",
      scripts: {
        replay: "bun scripts/cost-guardrails-replay.ts",
        status: "bun scripts/cost-guardrails-status.ts",
      },
      dependencies: {
        "@opencode-ai/plugin": "1.2.6",
      },
    },
    null,
    2,
  ) + "\n",
);

// tsconfig.json
fs.writeFileSync(
  path.join(dest, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        types: ["bun-types"],
      },
    },
    null,
    2,
  ) + "\n",
);

// .gitignore
fs.writeFileSync(path.join(dest, ".gitignore"), "node_modules\n");

// README.md
fs.writeFileSync(
  path.join(dest, "README.md"),
  `# opencode-cost-guardrails

An [opencode](https://opencode.ai) plugin that tracks AI spending in SQLite and fires
TUI toasts when configurable cost thresholds are hit. Optionally blocks all tool calls
once a hard limit is reached.

## Install

Copy \`plugins/cost-guardrails.ts\` to your opencode plugin directory:

- Global: \`~/.config/opencode/plugins/\`
- Project: \`.opencode/plugins/\`

## Configuration

All settings are via environment variables (e.g. in your shell profile or \`.env\`).

| Variable | Description |
|---|---|
| \`OPENCODE_COST_GUARD_SESSION_LIMIT\` | Per-session limit ($) |
| \`OPENCODE_COST_GUARD_PROJECT_LIMIT\` | Per-project all-time limit ($) |
| \`OPENCODE_COST_GUARD_DAILY_LIMIT\` | Per-project daily limit ($) |
| \`OPENCODE_COST_GUARD_WEEKLY_LIMIT\` | Per-project weekly limit ($) |
| \`OPENCODE_COST_GUARD_MONTHLY_LIMIT\` | Per-project monthly limit ($) |
| \`OPENCODE_COST_GUARD_SYSTEM_LIMIT\` | System-wide all-time limit ($) |
| \`OPENCODE_COST_GUARD_SYSTEM_DAILY_LIMIT\` | System-wide daily limit ($) |
| \`OPENCODE_COST_GUARD_SYSTEM_WEEKLY_LIMIT\` | System-wide weekly limit ($) |
| \`OPENCODE_COST_GUARD_SYSTEM_MONTHLY_LIMIT\` | System-wide monthly limit ($) |
| \`OPENCODE_COST_GUARD_WARNING_PERCENT\` | Warning threshold, 0–1 (default: 0.8) |
| \`OPENCODE_COST_GUARD_HARD_LIMIT\` | Set to \`1\` to block tool calls at limit |
| \`OPENCODE_COST_GUARD_STATE_DIR\` | Override DB directory (default: \`~/.config/opencode/state\`) |

## Scripts

\`\`\`bash
# Replay a session to test thresholds
bun scripts/cost-guardrails-replay.ts [sessionID]

# Inspect DB state
bun scripts/cost-guardrails-status.ts [projectID]
\`\`\`
`,
);

// bun install + git init
$.cwd(dest);
await $`bun install`;
await $`git init`;
await $`git add -A`;
await $`git commit -m "init"`;

console.log(`
Done. Repo ready at ${dest}

To use the plugin, copy it to your opencode plugins dir:
  cp ${dest}/plugins/cost-guardrails.ts ~/.config/opencode/plugins/
`);
