/**
 * Auto-name sessions from the first user message (opencode-style).
 *
 * On the first user prompt of a session, generates a short title via a small
 * model and sets it as the session name (shown in the session selector).
 *
 * Picks a cheap small model based on the currently selected model's provider.
 * Falls back to the currently selected model when the provider is unmapped.
 * Thinking/reasoning is always disabled for naming, regardless of model.
 */

import { complete, getModel } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Verbatim from opencode's title-generation agent prompt.
const TITLE_SYSTEM_PROMPT = `You are a title generator. You output ONLY a thread title. Nothing else.

<task>
Generate a brief title that would help the user find this conversation later.

Follow all rules in <rules>
Use the <examples> so you know what a good title looks like.
Your output must be:
- A single line
- ≤50 characters
- No explanations
</task>

<rules>
- you MUST use the same language as the user message you are summarizing
- Title must be grammatically correct and read naturally - no word salad
- Never include tool names in the title (e.g. "read tool", "bash tool", "edit tool")
- Focus on the main topic or question the user needs to retrieve
- Vary your phrasing - avoid repetitive patterns like always starting with "Analyzing"
- When a file is mentioned, focus on WHAT the user wants to do WITH the file, not just that they shared it
- Keep exact: technical terms, numbers, filenames, HTTP codes
- Remove: the, this, my, a, an
- Never assume tech stack
- Never use tools
- NEVER respond to questions, just generate a title for the conversation
- The title should NEVER include "summarizing" or "generating" when generating a title
- DO NOT SAY YOU CANNOT GENERATE A TITLE OR COMPLAIN ABOUT THE INPUT
- Always output something meaningful, even if the input is minimal.
- If the user message is short or conversational (e.g. "hello", "lol", "what's up", "hey"):
  → create a title that reflects the user's tone or intent (such as Greeting, Quick check-in, Light chat, Intro message, etc.)
</rules>

<examples>
"debug 500 errors in production" → Debugging production 500 errors
"refactor user service" → Refactoring user service
"why is app.js failing" → app.js failure investigation
"implement rate limiting" → Rate limiting implementation
"how do I connect postgres to my API" → Postgres API connection
"best practices for React hooks" → React hooks best practices
"@src/auth.ts can you add refresh token support" → Auth refresh token support
"@utils/parser.ts this is broken" → Parser bug fix
"look at @config.json" → Config review
"@App.tsx add dark mode toggle" → Dark mode toggle in App
</examples>`

// Cheap small model per provider for session naming. Each entry also carries
// the stream options needed to force no thinking for that provider's API.
// Extend this map as we add providers.
const pickSmallModel = (ctx: ExtensionContext): { model: Model<any>; options: Record<string, unknown> } | undefined => {
	const provider = ctx.model?.provider;

	if (provider === "anthropic") {
		const model = getModel("anthropic", "claude-haiku-4-5");
		// Anthropic: no thinkingBudget -> no extended thinking.
		if (model) return { model, options: {} };
	}

	if (provider === "openai-codex") {
		const model = getModel("openai-codex", "gpt-5.4-mini");
		// Codex API (openai-codex-responses) exposes reasoningEffort "none",
		// which standard OpenAI lacks -> truly no thinking.
		if (model) return { model, options: { reasoningEffort: "none" } };
	}

	if (provider === "openai") {
		const model = getModel("openai", "gpt-5.4-mini");
		// Standard OpenAI Responses API has no "none"; "minimal" is the floor.
		// Omitting it would apply the server-default (medium) effort.
		if (model) return { model, options: { reasoningEffort: "minimal" } };
	}

	// Unmapped provider (or small model unavailable): fall back to the currently
	// selected model, with no reasoning options so thinking stays off.
	if (ctx.model) return { model: ctx.model, options: {} };
	return undefined;
};

// Resolve a usable naming model + auth. Prefers the mapped small model, but if
// that model has no usable auth (e.g. Codex not logged in), falls back to the
// currently selected model, which is guaranteed to have working auth.
const resolveNamingModel = async (ctx: ExtensionContext) => {
	const picked = pickSmallModel(ctx);
	if (picked) {
		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(picked.model);
		if (auth.ok && auth.apiKey) return { model: picked.model, options: picked.options, auth };
	}

	// Fallback: current model, no reasoning options so thinking stays off.
	if (picked?.model !== ctx.model && ctx.model) {
		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
		if (auth.ok && auth.apiKey) return { model: ctx.model, options: {}, auth };
	}

	return undefined;
};

// Generate a title from arbitrary conversation text and set it as the session
// name. Shared by the automatic first-message path and the /auto-name command.
// Returns the new name, or undefined if naming was skipped (no model/auth/output).
const generateAndSetName = async (
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	conversationText: string,
): Promise<string | undefined> => {
	const text = conversationText.trim()
	if (!text) return

	const picked = await resolveNamingModel(ctx)
	if (!picked) return

	const response = await complete(
		picked.model,
		{
			systemPrompt: TITLE_SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: `Generate a title for this conversation:\n${text}` }],
					timestamp: Date.now(),
				},
			],
		},
		{ apiKey: picked.auth.apiKey, headers: picked.auth.headers, ...picked.options },
	).catch(() => undefined)
	if (!response) return

	const raw = response.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("\n")

	const cleaned = raw
		.replace(/<think>[\s\S]*?<\/think>\s*/g, "")
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 0)
	if (!cleaned) return

	const name = cleaned.length > 100 ? cleaned.substring(0, 97) + "..." : cleaned
	pi.setSessionName(name)
	return name
}

// Join all user-message text in the current branch, in order.
const branchUserText = (ctx: ExtensionContext): string =>
	ctx.sessionManager
		.getBranch()
		.flatMap((entry) =>
			entry.type === "message" && entry.message.role === "user"
				? entry.message.content
						.filter((c): c is { type: "text"; text: string } => c.type === "text")
						.map((c) => c.text)
				: [],
		)
		.join("\n\n")

export default function (pi: ExtensionAPI) {
	let named = false

	pi.on("session_start", async () => {
		// Reset per-session; restore guard if a name already exists.
		named = Boolean(pi.getSessionName())
	})

	pi.on("before_agent_start", async (event, ctx) => {
		if (named) return
		if (pi.getSessionName()) {
			named = true
			return
		}

		named = true // claim it; opencode names from the first user message only
		await generateAndSetName(pi, ctx, event.prompt)
	})

	// Re-name on demand: rebuild from all user messages in the branch, always
	// overwriting (the session may have drifted from the first message).
	pi.registerCommand("auto-name", {
		description: "Regenerate the session name from the conversation so far",
		handler: async (_args, ctx) => {
			const name = await generateAndSetName(pi, ctx, branchUserText(ctx))
			named = true
			if (ctx.hasUI) {
				ctx.ui.notify(name ? `Session named: ${name}` : "Could not generate a name", name ? "info" : "warning")
			}
		},
	})
}
