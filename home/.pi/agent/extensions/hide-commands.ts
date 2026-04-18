/**
 * Hide Commands Extension
 *
 * Hides configured extension commands from `/` autocomplete and `pi.getCommands()`.
 * Commands still execute if typed manually; this only patches command listing.
 *
 * Config: ~/.pi/agent/hide-commands.json
 *
 * {
 *   "hiddenCommands": ["plannotator-status"]
 * }
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExtensionRunner, getAgentDir, type ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface HideCommandsConfig {
	hiddenCommands: string[];
}

interface HideCommandsConfigLoadResult {
	config: HideCommandsConfig;
	error?: string;
}

interface HideCommandsPatchState {
	loadHiddenCommands: () => ReadonlySet<string>;
}

const CONFIG_FILE = "hide-commands.json";
const PATCH_APPLIED_KEY = Symbol.for("rymi.pi.hide-commands.patch-applied");
const PATCH_STATE_KEY = Symbol.for("rymi.pi.hide-commands.patch-state");

const globalPatchState = globalThis as typeof globalThis & {
	[PATCH_APPLIED_KEY]?: boolean;
	[PATCH_STATE_KEY]?: HideCommandsPatchState;
};

function configPath(): string {
	return join(getAgentDir(), CONFIG_FILE);
}

function emptyConfig(): HideCommandsConfig {
	return { hiddenCommands: [] };
}

function parseConfig(value: unknown): HideCommandsConfigLoadResult {
	if (typeof value !== "object" || value === null) {
		return {
			config: emptyConfig(),
			error: `Expected top-level object in ${configPath()}`,
		};
	}

	const hiddenCommands = (value as { hiddenCommands?: unknown }).hiddenCommands;
	if (hiddenCommands === undefined) {
		return {
			config: emptyConfig(),
			error: `Missing 'hiddenCommands' array in ${configPath()}`,
		};
	}
	if (!Array.isArray(hiddenCommands)) {
		return {
			config: emptyConfig(),
			error: `'hiddenCommands' must be an array in ${configPath()}`,
		};
	}

	const invalidEntries = hiddenCommands.filter((entry) => typeof entry !== "string" || entry.trim().length === 0);
	if (invalidEntries.length > 0) {
		return {
			config: emptyConfig(),
			error: `'hiddenCommands' must contain only non-empty strings in ${configPath()}`,
		};
	}

	return {
		config: {
			hiddenCommands: hiddenCommands.map((entry) => entry.trim()),
		},
	};
}

function loadConfig(): HideCommandsConfigLoadResult {
	const path = configPath();
	if (!existsSync(path)) return { config: emptyConfig() };

	try {
		const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
		return parseConfig(raw);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			config: emptyConfig(),
			error: `Failed to parse ${path}: ${message}`,
		};
	}
}

function loadHiddenCommands(): ReadonlySet<string> {
	return new Set(loadConfig().config.hiddenCommands);
}

function installPatch(): void {
	const patchState = globalPatchState[PATCH_STATE_KEY] ?? { loadHiddenCommands };
	patchState.loadHiddenCommands = loadHiddenCommands;
	globalPatchState[PATCH_STATE_KEY] = patchState;

	if (globalPatchState[PATCH_APPLIED_KEY]) return;

	const originalGetRegisteredCommands = ExtensionRunner.prototype.getRegisteredCommands;
	ExtensionRunner.prototype.getRegisteredCommands = function patchedGetRegisteredCommands(this: ExtensionRunner) {
		const commands = originalGetRegisteredCommands.call(this);
		const hiddenCommands = patchState.loadHiddenCommands();
		if (hiddenCommands.size === 0) return commands;

		return commands.filter((command) => !hiddenCommands.has(command.name) && !hiddenCommands.has(command.invocationName));
	};

	globalPatchState[PATCH_APPLIED_KEY] = true;
}

installPatch();

export default function hideCommandsExtension(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const { error } = loadConfig();
		if (error) ctx.ui.notify(`hide-commands: ${error}`, "warning");
	});
}
