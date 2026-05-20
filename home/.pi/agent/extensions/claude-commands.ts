/**
 * Claude Commands Autocomplete
 *
 * Registers repo-local markdown files under `.claude/commands` as Pi slash commands.
 * Flat commands use `/name`; nested commands use Claude-style namespaces:
 * `.claude/commands/foo/bar.md` -> `/foo:bar`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

interface ExtensionAPI {
	on(event: "session_start", handler: (event: unknown, ctx: ExtensionContext) => Promise<void> | void): void;
	registerCommand(name: string, options: CommandOptions): void;
	sendUserMessage(content: string, options?: { deliverAs: "steer" | "followUp" }): void;
}

interface ExtensionContext {
	cwd: string;
	isIdle(): boolean;
	ui: {
		notify(message: string, level?: "info" | "warning" | "error" | "success"): void;
	};
}

interface CommandOptions {
	description?: string;
	handler(args: string, ctx: ExtensionContext): Promise<void> | void;
}

interface ParsedCommandFile {
	frontmatter: Record<string, string>;
	body: string;
}

interface ClaudeCommand {
	name: string;
	path: string;
	description: string;
}

const COMMANDS_DIR = join(".claude", "commands");
const DESCRIPTION_MAX = 80;

function parseFrontmatter(raw: string): ParsedCommandFile {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) return { frontmatter: {}, body: raw };

	const frontmatter: Record<string, string> = {};
	const lines = match[1]?.split(/\r?\n/) ?? [];
	for (const line of lines) {
		const separator = line.indexOf(":");
		if (separator <= 0) continue;

		const key = line.slice(0, separator).trim();
		const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
		if (key) frontmatter[key] = value;
	}

	return { frontmatter, body: raw.slice(match[0].length) };
}

function firstBodyLine(body: string): string | undefined {
	return body
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0);
}

function truncate(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function commandName(commandsDir: string, filePath: string): string | undefined {
	const rel = relative(commandsDir, filePath).replace(/\\/g, "/");
	if (!rel.endsWith(".md")) return undefined;

	const withoutExt = rel.slice(0, -".md".length);
	const parts = withoutExt.split("/").filter(Boolean);
	if (parts.length === 0 || parts.some((part) => part.startsWith("."))) return undefined;

	return parts.join(":");
}

function readDescription(filePath: string): string {
	try {
		const { frontmatter, body } = parseFrontmatter(readFileSync(filePath, "utf-8"));
		const description = frontmatter.description || firstBodyLine(body) || "Claude command";
		const argumentHint = frontmatter["argument-hint"];
		return argumentHint ? `${argumentHint} — ${truncate(description, DESCRIPTION_MAX)}` : truncate(description, DESCRIPTION_MAX);
	} catch {
		return "Claude command";
	}
}

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

function collectMarkdownFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectMarkdownFiles(path));
			continue;
		}

		let isFile = entry.isFile();
		if (entry.isSymbolicLink()) {
			try {
				isFile = statSync(path).isFile();
			} catch {
				isFile = false;
			}
		}

		if (isFile && entry.name.endsWith(".md")) files.push(path);
	}
	return files;
}

function ancestorCommandDirs(cwd: string): string[] {
	const dirs: string[] = [];
	let current = resolve(cwd);

	while (true) {
		const commandsDir = join(current, COMMANDS_DIR);
		if (existsSync(commandsDir) && isDirectory(commandsDir)) dirs.push(commandsDir);

		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}

	return dirs.reverse();
}

function discoverClaudeCommands(cwd: string): ClaudeCommand[] {
	const byName = new Map<string, ClaudeCommand>();

	for (const commandsDir of ancestorCommandDirs(cwd)) {
		for (const path of collectMarkdownFiles(commandsDir).sort((a, b) => a.localeCompare(b))) {
			const name = commandName(commandsDir, path);
			if (name) byName.set(name, { name, path, description: readDescription(path) });
		}
	}

	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function parseCommandArgs(argsString: string): string[] {
	const args: string[] = [];
	let current = "";
	let quote: string | undefined;

	for (const char of argsString) {
		if (quote) {
			if (char === quote) quote = undefined;
			else current += char;
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
		} else if (/\s/.test(char)) {
			if (current) {
				args.push(current);
				current = "";
			}
		} else {
			current += char;
		}
	}

	if (current) args.push(current);
	return args;
}

function substituteArgs(content: string, argsString: string): string {
	const args = parseCommandArgs(argsString);
	let result = content.replace(/\$(\d+)/g, (_match, index: string) => args[Number(index) - 1] ?? "");

	result = result.replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_match, start: string, length?: string) => {
		const startIndex = Math.max(Number(start) - 1, 0);
		return length === undefined
			? args.slice(startIndex).join(" ")
			: args.slice(startIndex, startIndex + Number(length)).join(" ");
	});

	const allArgs = args.join(" ");
	return result.replace(/\$ARGUMENTS/g, allArgs).replace(/\$@/g, allArgs);
}

function loadCommandPrompt(path: string, args: string): string | undefined {
	if (!existsSync(path)) return undefined;
	const { body } = parseFrontmatter(readFileSync(path, "utf-8"));
	return substituteArgs(body, args);
}

export default function claudeCommandsExtension(pi: ExtensionAPI) {
	pi.on("session_start", async (_event: unknown, ctx: ExtensionContext) => {
		for (const command of discoverClaudeCommands(ctx.cwd)) {
			pi.registerCommand(command.name, {
				description: command.description,
				handler: async (args, commandCtx) => {
					const prompt = loadCommandPrompt(command.path, args.trim());
					if (!prompt) {
						commandCtx.ui.notify(`Claude command not found: ${command.path}`, "warning");
						return;
					}

					const options = commandCtx.isIdle() ? undefined : { deliverAs: "steer" as const };
					pi.sendUserMessage(prompt, options);
				},
			});
		}
	});
}
