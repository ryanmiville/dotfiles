/**
 * Strips the skill frontmatter block from the system prompt.
 *
 * Skills still register as /skill:name slash commands — invoke them
 * explicitly that way. This just prevents the skill listing and
 * instructions from being loaded into every conversation's context.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const SKILL_BLOCK_RE =
  /\n*The following skills provide specialized instructions for specific tasks\.[\s\S]*?<\/available_skills>\n*/;

export default function noSkillPrompt(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    const stripped = event.systemPrompt.replace(SKILL_BLOCK_RE, "\n");
    if (stripped !== event.systemPrompt) {
      return { systemPrompt: stripped };
    }
  });
}
