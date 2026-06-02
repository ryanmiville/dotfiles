import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function isZedTerminal(): boolean {
  return process.env.ZED_TERM === "true" || process.env.TERM_PROGRAM === "zed";
}

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (_event, ctx) => {
    if (isZedTerminal()) {
      process.stdout.write("\x07");
    } else {
      process.stdout.write("\x1b]9;Pi agent finished\x07");
    }
  });
}
