import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { latestAssistantMarkdown, saveLatestAssistantMarkdown } from "./save.js";

const assistant = (...content: unknown[]) => ({ type: "assistant", content });

test("extracts only text from the latest assistant response", () => {
  const markdown = latestAssistantMarkdown([
    assistant({ type: "text", text: "old" }),
    assistant(
      { type: "reasoning", text: "hidden" },
      { type: "text", text: "# Latest" },
      { type: "tool", name: "read" },
      { type: "text", text: "Body" },
    ),
  ]);

  assert.equal(markdown, "# Latest\n\nBody");
});

test("writes Markdown without overwriting an existing file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "opencode-save-md-"));
  try {
    const messages = [assistant({ type: "text", text: "# Saved" })];
    const saved = await saveLatestAssistantMarkdown({ messages, name: "answer", directory });
    assert.deepEqual(saved, { status: "saved", path: join(directory, "answer.md") });
    assert.equal(await readFile(join(directory, "answer.md"), "utf8"), "# Saved\n");

    await writeFile(join(directory, "existing.md"), "original\n", "utf8");
    const exists = await saveLatestAssistantMarkdown({ messages, name: "existing.md", directory });
    assert.deepEqual(exists, { status: "exists", path: join(directory, "existing.md") });
    assert.equal(await readFile(join(directory, "existing.md"), "utf8"), "original\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reports missing response, name, and text", async () => {
  const directory = await mkdtemp(join(tmpdir(), "opencode-save-md-"));
  try {
    assert.deepEqual(
      await saveLatestAssistantMarkdown({ messages: [], name: "answer", directory }),
      { status: "no-assistant" },
    );
    assert.deepEqual(
      await saveLatestAssistantMarkdown({
        messages: [assistant({ type: "text", text: "answer" })],
        name: " ",
        directory,
      }),
      { status: "missing-name" },
    );
    assert.deepEqual(
      await saveLatestAssistantMarkdown({
        messages: [assistant({ type: "reasoning", text: "hidden" })],
        name: "answer",
        directory,
      }),
      { status: "no-text" },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
