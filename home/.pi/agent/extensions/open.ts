/**
 * /open command — open a file in nvim (new herdr tab) or a URL in the browser.
 *
 * Usage:
 *   /open path/to/file.rs      → nvim in a new herdr tab in the same workspace
 *   /open ~/path/to/file.rs    → tilde expanded to home dir
 *   /open https://example.com  → opens in default browser via macOS `open`
 *
 * Does not affect the session context.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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

export default function (pi: ExtensionAPI) {
  pi.registerCommand("open", {
    description: "Open a file in nvim (new herdr tab) or a URL in the browser",
    handler: async (args, ctx) => {
      const target = args.trim();

      if (!target) {
        ctx.ui.notify("/open <file-or-url>", "error");
        return;
      }

      // ── URL ────────────────────────────────────────────────────────────────
      if (/^https?:\/\//.test(target)) {
        spawnSync("open", [target]);
        ctx.ui.notify("Opened in browser", "info");
        return;
      }

      // ── File → nvim in a new herdr tab ─────────────────────────────────────
      if (process.env.HERDR_ENV !== "1") {
        ctx.ui.notify(`Not in herdr — run: nvim ${target}`, "warn");
        return;
      }

      const paneId = process.env.HERDR_PANE_ID;
      if (!paneId) {
        ctx.ui.notify("HERDR_PANE_ID not set", "error");
        return;
      }

      // Ask herdr for the workspace list and find the focused one.
      const wsList = spawnSync("herdr", ["workspace", "list"], { encoding: "utf-8" });
      if (wsList.status !== 0) {
        ctx.ui.notify(`herdr workspace list failed: ${wsList.stderr.trim()}`, "error");
        return;
      }
      const workspaces: Array<{ workspace_id: string; active_tab_id: string; focused?: boolean }> =
        JSON.parse(wsList.stdout).result.workspaces;
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

      // When nvim exits, refocus the original tab then close this one.
      const cmd = `nvim ${shellQuote(absPath)}; herdr tab focus ${originalTabId}; herdr tab close ${newTabId}`;
      spawnSync("herdr", ["pane", "run", newPaneId, cmd], { encoding: "utf-8" });

      ctx.ui.notify(`Opened ${target}`, "info");
    },
  });
}
