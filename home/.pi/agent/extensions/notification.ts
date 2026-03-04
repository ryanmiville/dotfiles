import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const SOUND_PATH = "/System/Library/Sounds/Glass.aiff";

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    try {
      await pi.exec("afplay", [SOUND_PATH]);
    } catch (error) {
      console.warn("[notification] failed to play completion sound:", error);
    }
  });
}
