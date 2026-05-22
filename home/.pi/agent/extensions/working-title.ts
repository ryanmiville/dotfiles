import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const BUSY_PREFIX = "⚙ ";
const APP_TITLE = "π";

function baseTitle(ctx: ExtensionContext): string {
	const cwd = basename(ctx.sessionManager.getCwd());
	const sessionName = ctx.sessionManager.getSessionName();
	return sessionName ? `${APP_TITLE} - ${sessionName} - ${cwd}` : `${APP_TITLE} - ${cwd}`;
}

function setBusyTitle(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setTitle(`${BUSY_PREFIX}${baseTitle(ctx)}`);
}

function setIdleTitle(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setTitle(baseTitle(ctx));
}

export default function workingTitleExtension(pi: ExtensionAPI) {
	pi.on("agent_start", async (_event, ctx) => {
		setBusyTitle(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (ctx.hasPendingMessages()) return;
		setIdleTitle(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		setIdleTitle(ctx);
	});
}
