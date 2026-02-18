import { tool } from "@opencode-ai/plugin"
import { createOpencodeClient } from "@opencode-ai/sdk"

export default tool({
  description:
    "Hand off work to a new session with targeted context from the current conversation. " +
    "Use when context is degrading or the window is nearly full. " +
    "Analyze the current conversation and extract ONLY the context relevant to the goal — " +
    "file paths, code snippets, decisions made, constraints discovered, current state of the work. " +
    "Leave behind anything no longer useful. The new session starts fresh with just that distilled context.",
  args: {
    goal: tool.schema
      .string()
      .describe(
        "Short description of what needs to be done next. Single sentence or short paragraph.",
      ),
    context: tool.schema
      .string()
      .describe(
        "The relevant context extracted from this conversation that the new session needs. " +
          "Include: key decisions, file paths and their current state, code patterns established, " +
          "constraints discovered, errors encountered and their resolutions. " +
          "Exclude: dead ends, superseded approaches, resolved issues, and anything not relevant to the goal.",
      ),
  },
  async execute(args, ctx) {
    const client = createOpencodeClient({
      baseUrl: "http://localhost:4096",
    })

    const { data: session } = await client.session.create({
      body: { title: `Handoff: ${args.goal}` },
    })

    const prompt = [
      "# Handoff from previous session",
      "",
      "## Goal",
      args.goal,
      "",
      "## Context from previous session",
      args.context,
    ].join("\n")

    await client.session.prompt({
      path: { id: session!.id },
      body: {
        noReply: true,
        parts: [{ type: "text", text: prompt }],
      },
    })

    const proc = Bun.spawn(
      ["opencode", "--session", session!.id],
      {
        cwd: ctx.directory,
        detached: true,
      },
    )
    proc.unref()

    return `New session started: ${session!.id}`
  },
})
