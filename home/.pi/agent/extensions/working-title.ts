import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const APP_TITLE = "π";
const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const SPINNER_INTERVAL_MS = 80;
const COMPLETION_FLASH_MS = 800;

let spinnerTimer: ReturnType<typeof setInterval> | undefined;
let completionTimer: ReturnType<typeof setTimeout> | undefined;
let frameIndex = 0;

function ghosttyWrite(seq: string): void {
	try {
		writeFileSync("/dev/tty", seq);
	} catch {
		// /dev/tty unavailable, e.g. subagent context.
	}
}

function setProgress(state: 0 | 1 | 3, value?: number): void {
	const args = value === undefined ? `${state}` : `${state};${value}`;
	ghosttyWrite(`\x1b]9;4;${args}\x07`);
}

function baseTitle(ctx: ExtensionContext): string {
	const cwd = basename(ctx.sessionManager.getCwd());
	const sessionName = ctx.sessionManager.getSessionName();
	return sessionName ? `${APP_TITLE} - ${sessionName} - ${cwd}` : `${APP_TITLE} - ${cwd}`;
}

function setIdleTitle(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setTitle(baseTitle(ctx));
}

function clearCompletionTimer(): void {
	if (!completionTimer) return;
	clearTimeout(completionTimer);
	completionTimer = undefined;
}

function clearSpinnerTimer(): void {
	if (!spinnerTimer) return;
	clearInterval(spinnerTimer);
	spinnerTimer = undefined;
}

function setSpinnerTitle(ctx: ExtensionContext): void {
	const frame = BRAILLE_FRAMES[frameIndex % BRAILLE_FRAMES.length];
	frameIndex++;
	ctx.ui.setTitle(`${frame} ${baseTitle(ctx)}`);
}

function startSpinner(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;

	clearSpinnerTimer();
	clearCompletionTimer();
	frameIndex = 0;
	setProgress(3);
	setSpinnerTitle(ctx);
	spinnerTimer = setInterval(() => setSpinnerTitle(ctx), SPINNER_INTERVAL_MS);
}

function stopSpinner(ctx: ExtensionContext): void {
	clearSpinnerTimer();
	if (!ctx.hasUI) return;

	setProgress(1, 100);
	setIdleTitle(ctx);
	completionTimer = setTimeout(() => {
		setProgress(0);
		completionTimer = undefined;
	}, COMPLETION_FLASH_MS);
}

export default function workingTitleExtension(pi: ExtensionAPI) {
	pi.on("agent_start", async (_event, ctx) => {
		startSpinner(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (ctx.hasPendingMessages()) return;
		stopSpinner(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		clearSpinnerTimer();
		clearCompletionTimer();
		setProgress(0);
		setIdleTitle(ctx);
	});
}
