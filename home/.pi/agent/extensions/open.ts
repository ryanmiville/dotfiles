/**
 * /open command — open a file in nvim (new herdr tab) or a URL in the browser.
 *
 * Usage:
 *   /open path/to/file.rs      → nvim in a new herdr tab in the same workspace
 *   /open ~/path/to/file.rs    → tilde expanded to home dir
 *   /open https://example.com  → opens in default browser via macOS `open`
 *   /open                      → infers the most relevant URL/file from the last assistant message
 *
 * Does not affect the session context.
 */
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { homedir } from "node:os";

/** Single-quote-escape a string for POSIX shell. */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/** Expand leading `~/` to the user's home directory. */
function expandPath(target: string, cwd: string): string {
  if (target === "~" || target.startsWith("~/")) {
    return resolve(homedir(), target.slice(2));
  }
  return resolve(cwd, target);
}

/** Extract text from the last assistant message in the session. */
function getLastAssistantText(ctx: ExtensionCommandContext): string | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i] as {
      type: string;
      message?: { role?: string; content?: unknown };
    };
    if (entry.type !== "message" || entry.message?.role !== "assistant") continue;
    const content = entry.message.content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) continue;
    const texts: string[] = [];
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: string }).type === "text") {
        const text = (part as { text?: string }).text;
        if (text) texts.push(text);
      }
    }
    if (texts.length > 0) return texts.join("\n");
  }
  return undefined;
}

/** Extract the last URL or file path from text using simple pattern matching. */
function inferTarget(text: string): string | undefined {
  // Find all URLs — take the last one (most likely the "result" link)
  const urls = text.match(/https?:\/\/[^\s)\]>"'`]+/g);
  if (urls && urls.length > 0) return urls[urls.length - 1];

  // Fall back to file paths (absolute or ~/ prefixed)
  const paths = text.match(/(?:~\/|\/)\S+/g);
  if (paths && paths.length > 0) return paths[paths.length - 1];

  return undefined;
}

function openUrl(target: string, ctx: ExtensionCommandContext) {
  spawnSync("open", [target]);
  ctx.ui.notify(`Opened ${target}`, "info");
}

function openFile(target: string, ctx: ExtensionCommandContext) {
  if (process.env.HERDR_ENV !== "1") {
    ctx.ui.notify(`Not in herdr — run: nvim ${target}`, "warn");
    return;
  }

  const paneId = process.env.HERDR_PANE_ID;
  if (!paneId) {
    ctx.ui.notify("HERDR_PANE_ID not set", "error");
    return;
  }

  const wsList = spawnSync("herdr", ["workspace", "list"], { encoding: "utf-8" });
  if (wsList.status !== 0) {
    ctx.ui.notify(`herdr workspace list failed: ${wsList.stderr.trim()}`, "error");
    return;
  }
  const workspaces: Array<{
    workspace_id: string;
    active_tab_id: string;
    focused?: boolean;
  }> = JSON.parse(wsList.stdout).result.workspaces;
  const focused = workspaces.find((w) => w.focused);
  if (!focused) {
    ctx.ui.notify("No focused herdr workspace found", "error");
    return;
  }
  const workspaceId = focused.workspace_id;
  const originalTabId = focused.active_tab_id;
  const absPath = expandPath(target, ctx.cwd);

  const tabResult = spawnSync(
    "herdr",
    ["tab", "create", "--workspace", workspaceId, "--label", basename(absPath), "--focus"],
    { encoding: "utf-8" },
  );

  if (tabResult.status !== 0) {
    ctx.ui.notify(`herdr tab create failed: ${tabResult.stderr.trim()}`, "error");
    return;
  }

  const tabJson = JSON.parse(tabResult.stdout).result;
  const newPaneId: string = tabJson.root_pane.pane_id;
  const newTabId: string = tabJson.tab.tab_id;

  const cmd = `nvim ${shellQuote(absPath)}; herdr tab focus ${originalTabId}; herdr tab close ${newTabId}`;
  spawnSync("herdr", ["pane", "run", newPaneId, cmd], { encoding: "utf-8" });

  ctx.ui.notify(`Opened ${target}`, "info");
}

function openTarget(target: string, ctx: ExtensionCommandContext) {
  if (/^https?:\/\//.test(target)) {
    openUrl(target, ctx);
  } else {
    openFile(target, ctx);
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("open", {
    description: "Open a file in nvim or a URL in the browser (infers from context if no argument)",
    handler: async (args, ctx) => {
      const target = args.trim();

      if (target) {
        openTarget(target, ctx);
        return;
      }

      // No argument — infer from last assistant message
      const lastText = getLastAssistantText(ctx);
      if (!lastText) {
        ctx.ui.notify("No recent assistant message to infer from", "error");
        return;
      }

      const inferred = inferTarget(lastText);

      if (!inferred) {
        ctx.ui.notify("Could not infer a URL or file to open", "error");
        return;
      }

      openTarget(inferred, ctx);
    },
  });
}
