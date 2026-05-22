import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const NOTIFICATION_TITLE = "Pi";
const NOTIFICATION_SUBTITLE = "Done";
const NOTIFICATION_MESSAGE = "Agent finished.";

function isZedTerminal(): boolean {
  return process.env.ZED_TERM === "true" || process.env.TERM_PROGRAM === "zed";
}

function notifyZed(): void {
  process.stdout.write("\x07");
}

function appleScriptString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (_event, ctx) => {
    if (isZedTerminal()) {
      notifyZed();
      return;
    }

    if (!ctx.hasUI || process.platform !== "darwin") return;

    const script = [
      "display notification",
      appleScriptString(NOTIFICATION_MESSAGE),
      "with title",
      appleScriptString(NOTIFICATION_TITLE),
      "subtitle",
      appleScriptString(NOTIFICATION_SUBTITLE),
    ].join(" ");

    try {
      await pi.exec("osascript", ["-e", script]);
    } catch (error) {
      console.warn("[notification] failed to show completion notification:", error);
    }
  });
}
