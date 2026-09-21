import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type AssistantText = {
  type: "text";
  text: string;
};

type AssistantMessage = {
  type: "assistant";
  content: unknown[];
};

export type SaveResult =
  | { status: "saved"; path: string }
  | { status: "no-assistant" }
  | { status: "missing-name" }
  | { status: "no-text" }
  | { status: "exists"; path: string };

function isAssistantMessage(value: unknown): value is AssistantMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "assistant" &&
    "content" in value &&
    Array.isArray(value.content)
  );
}

function isAssistantText(value: unknown): value is AssistantText {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "text" &&
    "text" in value &&
    typeof value.text === "string"
  );
}

export function latestAssistantMarkdown(messages: readonly unknown[]): string | undefined {
  const message = messages.findLast(isAssistantMessage);
  if (!message) return undefined;

  return message.content.filter(isAssistantText).map((part) => part.text).join("\n\n");
}

export async function saveLatestAssistantMarkdown(input: {
  messages: readonly unknown[];
  name: string;
  directory: string;
}): Promise<SaveResult> {
  const markdown = latestAssistantMarkdown(input.messages);
  if (markdown === undefined) return { status: "no-assistant" };

  const name = input.name.trim();
  if (!name) return { status: "missing-name" };
  if (!markdown.trim()) return { status: "no-text" };

  const fileName = name.endsWith(".md") ? name : `${name}.md`;
  const path = resolve(input.directory, fileName);

  try {
    await writeFile(path, markdown.endsWith("\n") ? markdown : `${markdown}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      return { status: "exists", path };
    }
    throw error;
  }

  return { status: "saved", path };
}
