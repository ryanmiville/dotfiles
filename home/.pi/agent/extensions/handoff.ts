import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { BorderedLoader } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const HANDOFF_STATE_TYPE = "handoff-session";
const HANDOFF_ANCHOR_TYPE = "handoff-anchor";

type HandoffSessionState = {
	active: boolean;
	originId?: string;
};

type HandoffMode = "fresh" | "full";
type EndHandoffAction = "returnOnly" | "returnAndSummarize";
type EndHandoffResult = "ok" | "cancelled" | "error";

let handoffOriginId: string | undefined;
let endHandoffInProgress = false;

function setHandoffWidget(ctx: ExtensionContext, active: boolean): void {
	if (!ctx.hasUI) return;
	if (!active) {
		ctx.ui.setWidget("handoff", undefined);
		return;
	}

	ctx.ui.setWidget("handoff", (_tui, theme) => {
		const text = new Text(theme.fg("warning", "Handoff branch active, return with /end-handoff"), 0, 0);
		return {
			render(width: number) {
				return text.render(width);
			},
			invalidate() {
				text.invalidate();
			},
		};
	});
}

function getHandoffState(ctx: ExtensionContext): HandoffSessionState | undefined {
	let state: HandoffSessionState | undefined;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type === "custom" && entry.customType === HANDOFF_STATE_TYPE) {
			state = entry.data as HandoffSessionState | undefined;
		}
	}
	return state;
}

function applyHandoffState(ctx: ExtensionContext): void {
	const state = getHandoffState(ctx);
	if (state?.active && state.originId) {
		handoffOriginId = state.originId;
		setHandoffWidget(ctx, true);
		return;
	}

	handoffOriginId = undefined;
	setHandoffWidget(ctx, false);
}

function appendHandoffState(pi: ExtensionAPI, originId: string): void {
	handoffOriginId = originId;
	pi.appendEntry(HANDOFF_STATE_TYPE, { active: true, originId });
}

function clearHandoffState(pi: ExtensionAPI, ctx: ExtensionContext): void {
	handoffOriginId = undefined;
	setHandoffWidget(ctx, false);
	pi.appendEntry(HANDOFF_STATE_TYPE, { active: false });
}

function quoteFocus(focus: string): string {
	const trimmed = focus.trim();
	return trimmed ? `\n\nUser steering / next-session focus:\n${trimmed}` : "";
}

function buildFreshSummaryInstructions(focus: string): string {
	return `Write handoff context for a fresh Pi branch.

Summarize only what a new agent needs to continue from here. Do not write a temp file. Do not duplicate content already captured in artifacts (PRDs, plans, ADRs, issues, commits, diffs); reference those by path or URL instead.

Include:
- Goal / current task
- Relevant decisions and constraints
- Files, commands, diffs, issues, docs, or URLs that matter
- Current status and open questions
- Suggested skills to use next, if any
- Concrete next steps

Be concise but complete. Preserve exact paths, command names, identifiers, and error messages where useful.${quoteFocus(focus)}`;
}

function buildFreshKickoffPrompt(focus: string): string {
	return `We are now in a handoff branch with fresh context.

Use the handoff summary attached to this branch as the source of truth. Do not assume omitted prior conversation unless it is referenced by path, URL, commit, diff, issue, or artifact.
${focus.trim() ? `\nFocus / steering:\n${focus.trim()}\n` : ""}
Start by briefly restating the actionable context and next step, then proceed if the task is clear. If not, ask one concise clarifying question.`;
}

function buildFullKickoffPrompt(focus: string): string {
	return `We are starting a handoff branch that keeps the full existing context.

First create concise handoff context for this branch, using the same rules:
- Do not write a temp file.
- Do not duplicate content already captured in artifacts; reference paths/URLs instead.
- Include suggested skills if useful.
- Preserve exact paths, identifiers, commands, and errors where useful.
${focus.trim() ? `\nFocus / steering:\n${focus.trim()}\n` : ""}
Then state the next step and proceed if the task is clear. If not, ask one concise clarifying question.`;
}

const END_HANDOFF_SUMMARY_PROMPT = `We are leaving a handoff branch and returning to the original branch.

Write a concise progress update about what happened in the handoff branch. This is for the original branch after implementation/exploration work is done.

Include only:
- What changed or was accomplished
- Files/areas touched
- Important decisions or discoveries
- Verification run and results
- Remaining follow-ups or blockers

Keep it short. Do not recreate the original handoff context unless needed to explain progress. Preserve exact paths, commands, identifiers, and error messages.`;

function firstUserMessageId(ctx: ExtensionContext): string | undefined {
	const entry = ctx.sessionManager
		.getEntries()
		.find((e) => e.type === "message" && e.message.role === "user");
	return entry?.id;
}

function getOrCreateOriginId(pi: ExtensionAPI, ctx: ExtensionCommandContext): string | undefined {
	let originId = ctx.sessionManager.getLeafId() ?? undefined;
	if (originId) return originId;

	pi.appendEntry(HANDOFF_ANCHOR_TYPE, { createdAt: new Date().toISOString() });
	originId = ctx.sessionManager.getLeafId() ?? undefined;
	return originId;
}

async function navigateWithLoader(
	ctx: ExtensionCommandContext,
	targetId: string,
	options: Parameters<ExtensionCommandContext["navigateTree"]>[1],
	message: string,
): Promise<{ cancelled: boolean; error?: string } | null> {
	if (!ctx.hasUI) {
		try {
			return await ctx.navigateTree(targetId, options);
		} catch (error) {
			return { cancelled: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	return ctx.ui.custom<{ cancelled: boolean; error?: string } | null>((tui, theme, _kb, done) => {
		const loader = new BorderedLoader(tui, theme, message);
		loader.onAbort = () => done(null);

		ctx.navigateTree(targetId, options)
			.then(done)
			.catch((err) => done({ cancelled: false, error: err instanceof Error ? err.message : String(err) }));

		return loader;
	});
}

async function startFreshHandoff(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	originId: string,
	focus: string,
): Promise<boolean> {
	const targetId = firstUserMessageId(ctx);
	const lockedOriginId = originId;

	if (targetId) {
		const result = await navigateWithLoader(
			ctx,
			targetId,
			{
				summarize: true,
				customInstructions: buildFreshSummaryInstructions(focus),
				replaceInstructions: true,
				label: "handoff",
			},
			"Creating handoff branch summary...",
		);

		if (result === null) {
			ctx.ui.notify("Handoff cancelled", "info");
			return false;
		}
		if (result.error) {
			ctx.ui.notify(`Failed to start handoff: ${result.error}`, "error");
			return false;
		}
		if (result.cancelled) {
			ctx.ui.notify("Handoff navigation cancelled", "info");
			return false;
		}

		ctx.ui.setEditorText("");
	}

	appendHandoffState(pi, lockedOriginId);
	setHandoffWidget(ctx, true);
	pi.sendUserMessage(buildFreshKickoffPrompt(focus));
	return true;
}

async function startFullHandoff(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	originId: string,
	focus: string,
): Promise<boolean> {
	appendHandoffState(pi, originId);
	setHandoffWidget(ctx, true);
	pi.sendUserMessage(buildFullKickoffPrompt(focus));
	return true;
}

function getActiveHandoffOrigin(ctx: ExtensionContext): string | undefined {
	if (handoffOriginId) return handoffOriginId;

	const state = getHandoffState(ctx);
	if (state?.active && state.originId) {
		handoffOriginId = state.originId;
		return state.originId;
	}

	return undefined;
}

async function executeEndHandoff(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	action: EndHandoffAction,
): Promise<EndHandoffResult> {
	const originId = getActiveHandoffOrigin(ctx);
	if (!originId) {
		ctx.ui.notify("Not in a handoff branch", "info");
		return "error";
	}

	const summarize = action === "returnAndSummarize";
	const result = summarize
		? await navigateWithLoader(
			ctx,
			originId,
			{
				summarize: true,
				customInstructions: END_HANDOFF_SUMMARY_PROMPT,
				replaceInstructions: true,
			},
			"Returning and summarizing handoff branch...",
		)
		: await navigateWithLoader(
			ctx,
			originId,
			{ summarize: false },
			"Returning to original branch...",
		);

	if (result === null) {
		ctx.ui.notify("Cancelled. Use /end-handoff to try again.", "info");
		return "cancelled";
	}
	if (result.error) {
		ctx.ui.notify(`Failed to end handoff: ${result.error}`, "error");
		return "error";
	}
	if (result.cancelled) {
		ctx.ui.notify("Navigation cancelled. Use /end-handoff to try again.", "info");
		return "cancelled";
	}

	clearHandoffState(pi, ctx);
	ctx.ui.notify(summarize ? "Handoff complete. Returned and summarized." : "Handoff complete. Returned.", "info");
	return "ok";
}

export default function handoffBranchExtension(pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		applyHandoffState(ctx);
	});

	pi.on("session_tree", (_event, ctx) => {
		applyHandoffState(ctx);
	});

	pi.registerCommand("handoff", {
		description: "Start a handoff branch with fresh or full context",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("handoff requires interactive mode", "error");
				return;
			}
			if (handoffOriginId) {
				ctx.ui.notify("Already in a handoff branch. Use /end-handoff first.", "warning");
				return;
			}

			const originId = getOrCreateOriginId(pi, ctx);
			if (!originId) {
				ctx.ui.notify("Failed to determine handoff origin", "error");
				return;
			}

			const messageCount = ctx.sessionManager
				.getEntries()
				.filter((e) => e.type === "message").length;
			let mode: HandoffMode = "fresh";
			if (messageCount > 0) {
				const choice = await ctx.ui.select("Start handoff in:", [
					"Fresh branch",
					"Full-context branch",
				]);
				if (choice === undefined) {
					ctx.ui.notify("Handoff cancelled", "info");
					return;
				}
				mode = choice === "Full-context branch" ? "full" : "fresh";
			}

			const focus = args.trim();
			const ok = mode === "fresh"
				? await startFreshHandoff(pi, ctx, originId, focus)
				: await startFullHandoff(pi, ctx, originId, focus);

			if (ok) {
				ctx.ui.notify(`Started handoff (${mode === "fresh" ? "fresh" : "full context"})`, "info");
			}
		},
	});

	pi.registerCommand("end-handoff", {
		description: "End handoff branch and return to original branch",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("end-handoff requires interactive mode", "error");
				return;
			}
			if (endHandoffInProgress) {
				ctx.ui.notify("/end-handoff already running", "info");
				return;
			}

			endHandoffInProgress = true;
			try {
				const choice = await ctx.ui.select("Finish handoff:", [
					"Return only",
					"Return and summarize progress",
				]);
				if (choice === undefined) {
					ctx.ui.notify("Cancelled. Use /end-handoff to try again.", "info");
					return;
				}

				await executeEndHandoff(
					pi,
					ctx,
					choice === "Return and summarize progress" ? "returnAndSummarize" : "returnOnly",
				);
			} finally {
				endHandoffInProgress = false;
			}
		},
	});
}
