import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const ENTRY_TYPE = "assistant-finished-at";

interface TimestampEntryData {
  messageId: string;
  timestamp: number;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  return `${time} - ${day}`;
}

function isTimestampFor(entry: SessionEntry, messageId: string): boolean {
  if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE) return false;
  return (entry.data as TimestampEntryData | undefined)?.messageId === messageId;
}

export default function (pi: ExtensionAPI) {
  pi.registerEntryRenderer<TimestampEntryData>(ENTRY_TYPE, (entry, _options, theme) => {
    const timestamp = entry.data?.timestamp ?? Date.parse(entry.timestamp);
    if (!Number.isFinite(timestamp)) return undefined;

    return new Text(theme.fg("dim", formatTimestamp(timestamp)), 1, 0);
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (!ctx.isIdle()) return;

    const branch = ctx.sessionManager.getBranch();
    for (let index = branch.length - 1; index >= 0; index--) {
      const entry = branch[index]!;
      if (entry.type !== "message") continue;

      const message = entry.message;
      if (message.role !== "assistant" || message.stopReason === "toolUse") return;

      const hasVisibleText = message.content.some(
        (block) => block.type === "text" && block.text.trim().length > 0,
      );
      if (!hasVisibleText) return;

      if (branch.slice(index + 1).some((later) => isTimestampFor(later, entry.id))) return;

      pi.appendEntry<TimestampEntryData>(ENTRY_TYPE, {
        messageId: entry.id,
        timestamp: Date.now(),
      });
      return;
    }
  });
}
