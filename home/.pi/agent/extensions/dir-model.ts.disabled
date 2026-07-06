/**
 * Directory-based Default Model Extension
 *
 * Sets the default model and thinking level based on the directory
 * where pi is started. Most specific (longest) path prefix wins.
 *
 * Config: ~/.pi/agent/dir-models.json
 *
 * Example:
 * ```json
 * {
 *   "~/dev/work": {
 *     "provider": "anthropic",
 *     "model": "claude-opus-4-6",
 *     "thinkingLevel": "high"
 *   },
 *   "~/dev/work/attack-team": {
 *     "provider": "anthropic",
 *     "model": "claude-sonnet-4-5",
 *     "thinkingLevel": "medium"
 *   },
 *   "*": {
 *     "provider": "openai",
 *     "model": "gpt-5.4",
 *     "thinkingLevel": "off"
 *   }
 * }
 * ```
 *
 * Usage:
 * - `/dir-model` — list all mappings
 * - `/dir-model set <path> <provider> <model> [thinkingLevel]` — add/update
 * - `/dir-model remove <path>` — remove a mapping
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";

interface DirModelEntry {
	provider: string;
	model: string;
	thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
}

type DirModelsConfig = Record<string, DirModelEntry>;

const CONFIG_FILE = "dir-models.json";

function configPath(): string {
	return join(getAgentDir(), CONFIG_FILE);
}

function loadConfig(): DirModelsConfig {
	const path = configPath();
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return {};
	}
}

function saveConfig(config: DirModelsConfig): void {
	const path = configPath();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/** Expand ~ and resolve to absolute path */
function expandPath(p: string): string {
	if (p === "*") return "*";
	const expanded = p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
	return resolve(expanded);
}

/**
 * Find the most specific (longest) matching path prefix for cwd.
 * "*" acts as a fallback that matches everything.
 */
function findMatch(config: DirModelsConfig, cwd: string): { path: string; entry: DirModelEntry } | undefined {
	let bestPath: string | undefined;
	let bestResolved = "";
	let bestEntry: DirModelEntry | undefined;

	for (const [configPath, entry] of Object.entries(config)) {
		if (configPath === "*") {
			// Wildcard is the least specific — only wins if nothing else matches
			if (!bestEntry) {
				bestPath = configPath;
				bestResolved = "";
				bestEntry = entry;
			}
			continue;
		}

		const resolved = expandPath(configPath);
		// cwd must equal or be under the configured directory
		if (cwd === resolved || cwd.startsWith(resolved + "/")) {
			if (resolved.length > bestResolved.length) {
				bestPath = configPath;
				bestResolved = resolved;
				bestEntry = entry;
			}
		}
	}

	if (bestPath !== undefined && bestEntry !== undefined) {
		return { path: bestPath, entry: bestEntry };
	}
	return undefined;
}

export default function dirModelExtension(pi: ExtensionAPI) {
	pi.on("session_start", async (event, ctx) => {
		// Only apply on fresh startup, not resume/fork/reload
		if (event.reason !== "startup" && event.reason !== "new") return;

		const config = loadConfig();
		const match = findMatch(config, ctx.cwd);
		if (!match) return;

		const { path, entry } = match;

		const model = ctx.modelRegistry.find(entry.provider, entry.model);
		if (!model) {
			ctx.ui.notify(`dir-model: model ${entry.provider}/${entry.model} not found (rule: ${path})`, "warning");
			return;
		}

		const success = await pi.setModel(model);
		if (!success) {
			ctx.ui.notify(`dir-model: no API key for ${entry.provider}/${entry.model}`, "warning");
			return;
		}

		if (entry.thinkingLevel) {
			pi.setThinkingLevel(entry.thinkingLevel);
		}

		ctx.ui.notify(
			`dir-model: ${entry.provider}/${entry.model}${entry.thinkingLevel ? ` (thinking: ${entry.thinkingLevel})` : ""} [${path}]`,
			"info",
		);
	});

	pi.registerCommand("dir-model", {
		description: "Manage directory-based default models",
		handler: async (args, ctx) => {
			const parts = args?.trim().split(/\s+/) ?? [];
			const subcommand = parts[0];

			if (subcommand === "set") {
				// /dir-model set <path> <provider> <model> [thinkingLevel]
				const [, dirPath, provider, model, thinkingLevel] = parts;
				if (!dirPath || !provider || !model) {
					ctx.ui.notify("Usage: /dir-model set <path> <provider> <model> [thinkingLevel]", "warning");
					return;
				}

				const validLevels = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
				if (thinkingLevel && !validLevels.includes(thinkingLevel as (typeof validLevels)[number])) {
					ctx.ui.notify(`Invalid thinking level. Valid: ${validLevels.join(", ")}`, "warning");
					return;
				}

				const config = loadConfig();
				const entry: DirModelEntry = { provider, model };
				if (thinkingLevel) {
					entry.thinkingLevel = thinkingLevel as DirModelEntry["thinkingLevel"];
				}
				config[dirPath] = entry;
				saveConfig(config);
				ctx.ui.notify(`Saved: ${dirPath} → ${provider}/${model}${thinkingLevel ? ` (${thinkingLevel})` : ""}`, "info");
				return;
			}

			if (subcommand === "remove") {
				const dirPath = parts[1];
				if (!dirPath) {
					ctx.ui.notify("Usage: /dir-model remove <path>", "warning");
					return;
				}
				const config = loadConfig();
				if (!(dirPath in config)) {
					ctx.ui.notify(`No mapping for "${dirPath}"`, "warning");
					return;
				}
				delete config[dirPath];
				saveConfig(config);
				ctx.ui.notify(`Removed mapping for "${dirPath}"`, "info");
				return;
			}

			// Default: list all mappings
			const config = loadConfig();
			const entries = Object.entries(config);
			if (entries.length === 0) {
				ctx.ui.notify("No directory model mappings. Use /dir-model set <path> <provider> <model> [thinkingLevel]", "info");
				return;
			}

			const lines = entries
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([dir, e]) => `  ${dir} → ${e.provider}/${e.model}${e.thinkingLevel ? ` (${e.thinkingLevel})` : ""}`);

			ctx.ui.notify("Directory model mappings:\n" + lines.join("\n"), "info");
		},
	});
}
