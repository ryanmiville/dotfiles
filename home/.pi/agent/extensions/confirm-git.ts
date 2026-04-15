import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type GitAction = "commit" | "push";

const GIT_ACTIONS = new Set<GitAction>(["commit", "push"]);
const GIT_OPTIONS_WITH_VALUE = new Set([
	"-c",
	"-C",
	"--config-env",
	"--exec-path",
	"--git-dir",
	"--namespace",
	"--super-prefix",
	"--work-tree",
]);
const SHELL_WRAPPERS = new Set(["builtin", "command", "env", "noglob", "time"]);

function splitCommand(command: string): string[] {
	return command
		.split(/&&|\|\||[;|\n]/g)
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0);
}

function tokenize(segment: string): string[] {
	return segment.match(/(?:[^\s"'`]+|"[^"]*"|'[^']*'|`[^`]*`)+/g) ?? [];
}

function stripQuotes(token: string): string {
	if (token.length < 2) return token;
	const first = token[0];
	const last = token[token.length - 1];
	if ((first === '"' && last === '"') || (first === "'" && last === "'") || (first === "`" && last === "`")) {
		return token.slice(1, -1);
	}
	return token;
}

function isEnvAssignment(token: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(token);
}

function isGitExecutable(token: string): boolean {
	return token === "git" || token.endsWith("/git");
}

function isGitAction(token: string): token is GitAction {
	return GIT_ACTIONS.has(token as GitAction);
}

function findProtectedAction(segment: string): GitAction | undefined {
	const tokens = tokenize(segment).map(stripQuotes);
	let index = 0;

	while (index < tokens.length) {
		const token = tokens[index];
		if (!token) break;
		if (isEnvAssignment(token) || SHELL_WRAPPERS.has(token)) {
			index += 1;
			continue;
		}
		break;
	}

	const executable = tokens[index];
	if (!executable || !isGitExecutable(executable)) return undefined;
	index += 1;

	while (index < tokens.length) {
		const token = tokens[index];
		if (!token) return undefined;
		if (token === "--") {
			index += 1;
			break;
		}
		if (token.startsWith("--")) {
			if (token.includes("=")) {
				index += 1;
				continue;
			}
			if (GIT_OPTIONS_WITH_VALUE.has(token)) {
				index += 2;
				continue;
			}
			index += 1;
			continue;
		}
		if (token.startsWith("-")) {
			if (GIT_OPTIONS_WITH_VALUE.has(token)) {
				index += 2;
				continue;
			}
			index += 1;
			continue;
		}
		return isGitAction(token) ? token : undefined;
	}

	const subcommand = tokens[index];
	return subcommand && isGitAction(subcommand) ? subcommand : undefined;
}

function findProtectedActions(command: string): GitAction[] {
	const actions = new Set<GitAction>();
	for (const segment of splitCommand(command)) {
		const action = findProtectedAction(segment);
		if (action) actions.add(action);
	}
	return [...actions];
}

function formatActionList(actions: readonly GitAction[]): string {
	return actions.map((action) => `git ${action}`).join(" / ");
}

async function confirmGitCommand(
	ctx: { hasUI: boolean; ui: { confirm(title: string, body: string): Promise<boolean> } },
	command: string,
	actions: readonly GitAction[],
): Promise<boolean> {
	if (!ctx.hasUI) return false;
	return ctx.ui.confirm(`Confirm ${formatActionList(actions)}?`, `pi wants to run:\n\n${command}`);
}

export default function confirmGitExtension(pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return;
		const command = typeof event.input.command === "string" ? event.input.command : "";
		const actions = findProtectedActions(command);
		if (actions.length === 0) return;

		if (!ctx.hasUI) {
			ctx.abort();
			return {
				block: true,
				reason: `${formatActionList(actions)} blocked: confirmation requires UI`,
			};
		}

		const confirmed = await confirmGitCommand(ctx, command, actions);
		if (confirmed) return;

		ctx.ui.notify(`Denied ${formatActionList(actions)}. agent stopped.`, "warning");
		ctx.abort();
		return { block: true, reason: "Blocked by user" };
	});
}
