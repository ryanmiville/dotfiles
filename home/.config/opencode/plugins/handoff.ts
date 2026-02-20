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
        // const messages = await input.client.session.messages({
        //   path: { id: commandInput.sessionID },
        //   query: { limit: 50 },
        // });

        // const lastUserMsg = messages.data
        //   ?.slice()
        //   .reverse()
        //   .find(
        //     (m): m is { info: UserMessage; parts: Part[] } =>
        //       m.info.role === "user",
        //   );

        // const model = lastUserMsg?.info.model ?? {
        //   providerID: "anthropic",
        //   modelID: "claude-3-5-sonnet-20241022",
        // };

        await input.client.session.summarize({
          path: { id: commandInput.sessionID },
          // body: {
          //   providerID: model.providerID,
          //   modelID: model.modelID,
          // },
        });

        // Create a new message AFTER the compaction summary so it lands on
        // the post-compaction side of filterCompacted's boundary cut.
        // The command's own message is created before session.summarize runs
        // (earlier ID), so filterCompacted drops it — this prompt is what
        // actually drives the AI to start working on the goal.
        await input.client.session.promptAsync({
          path: { id: commandInput.sessionID },
          body: {
            // model: { providerID: model.providerID, modelID: model.modelID },
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
      goals.delete(compactionInput.sessionID);

      output.prompt = `You are generating a continuation summary for a handoff. The user has explicitly requested a handoff with the following goal:
      ${goal}

      Provide a detailed prompt for continuing our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next. The summary will be used so another agent can read it and continue the work.

      Prioritize, in order:
      1. Context relevant to accomplishing the specific handoff goal
      2. Files, decisions, and state needed to continue toward that goal
      3. Any blockers or requirements mentioned that relate to that goal
      4. Current progress toward that goal (if any)

      When constructing the summary, stick to this template:
      ---
      ## Goal

      [What goal(s) is the user trying to accomplish?]

      ## Instructions

      - [Important instructions the user gave that are relevant]
      - [If there is a plan or spec, include information about it so next agent can continue using it]

      ## Discoveries

      [Notable things learned during this conversation that would be useful for the next agent]

      ## Accomplished

      [What work has been completed, what work is still in progress, and what work is left?]

      ## Relevant files / directories

      [Structured list of relevant files that have been read, edited, or created. If all files in a directory are relevant, include the directory path.]
      ---`;
    },
  };
};

export default handoffPlugin;
