/**
 * /clear — Navigate back to the root of the session tree with no summary.
 *
 * Starts a fresh context branch from the very first entry in the session,
 * while keeping everything in the same session tree.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function clearExtension(pi: ExtensionAPI) {
  pi.registerCommand("clear", {
    description: "Clear context — branch from root with no summary",
    handler: async (_args, ctx) => {
      const entries = ctx.sessionManager.getEntries();
      if (entries.length === 0) {
        ctx.ui.notify("Session is already empty", "info");
        return;
      }

      // Find the root entry (first entry with no parent)
      const root = entries.find((e) => e.parentId === null);
      if (!root) {
        ctx.ui.notify("Could not find root entry", "warning");
        return;
      }

      const { cancelled } = await ctx.navigateTree(root.id, {
        summarize: false,
      });

      if (!cancelled) {
        ctx.ui.notify("Context cleared — branched from root", "info");
      }
    },
  });
}
