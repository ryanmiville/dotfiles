import type { Plugin } from "@opencode-ai/plugin";
import type { Part, UserMessage } from "@opencode-ai/sdk";

const goals = new Map<string, string>();

const handoffPlugin: Plugin = async (input) => {
  return {
    "command.execute.before": async (commandInput, output) => {
      if (commandInput.command !== "handoff") return;

      const goal = commandInput.arguments.trim();
      if (!goal) {
        output.parts.push({
          type: "text",
          text: "Error: Please provide a goal. Usage: /handoff YOUR GOAL HERE",
        } as Part);
        return;
      }

      goals.set(commandInput.sessionID, goal);

      try {
        const messages = await input.client.session.messages({
          path: { id: commandInput.sessionID },
          query: { limit: 50 },
        });

        const lastUserMsg = messages.data
          ?.slice()
          .reverse()
          .find(
            (m): m is { info: UserMessage; parts: Part[] } =>
              m.info.role === "user",
          );

        const model = lastUserMsg?.info.model ?? {
          providerID: "anthropic",
          modelID: "claude-3-5-sonnet-20241022",
        };

        await input.client.session.summarize({
          path: { id: commandInput.sessionID },
          body: {
            providerID: model.providerID,
            modelID: model.modelID,
          },
        });

        // Create a new message AFTER the compaction summary so it lands on
        // the post-compaction side of filterCompacted's boundary cut.
        // The command's own message is created before session.summarize runs
        // (earlier ID), so filterCompacted drops it — this prompt is what
        // actually drives the AI to start working on the goal.
        await input.client.session.promptAsync({
          path: { id: commandInput.sessionID },
          body: {
            model: { providerID: model.providerID, modelID: model.modelID },
            parts: [{ type: "text", text: goal }],
          },
        });
      } catch (error) {
        goals.delete(commandInput.sessionID);
        output.parts.push({
          type: "text",
          text: `Error during handoff: ${error instanceof Error ? error.message : String(error)}`,
        } as Part);
      }
    },

    "experimental.session.compacting": async (compactionInput, output) => {
      const goal = goals.get(compactionInput.sessionID);
      if (!goal) return;

      output.context.push(`
## Handoff Goal

The user has explicitly requested a handoff with the following goal:
${goal}

When generating this continuation summary, prioritize:
1. Context relevant to accomplishing this specific goal
2. Files, decisions, and state needed to continue toward this goal
3. Any blockers or requirements mentioned that relate to this goal
4. Current progress toward this goal (if any)
`);

      goals.delete(compactionInput.sessionID);
    },
  };
};

export default handoffPlugin;
