import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

type AssistantTextBlock = { type?: string; text?: string };
type AssistantMessageLike = { role?: unknown; content?: unknown };
type SessionEntryLike = { id: string; type: string; message?: AssistantMessageLike };

type LastAssistantMessage = {
	entryId: string;
	text: string;
};

type NvimResult = {
	feedback: string;
	error?: string;
	exitCode?: number | null;
};

type NvimOpenRequest = {
	label: string;
	args: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function getAssistantMessageText(message: unknown): string | null {
	if (!isRecord(message)) return null;
	if (message.role !== "assistant" || !Array.isArray(message.content)) return null;

	const text = (message.content as AssistantTextBlock[])
		.filter((block): block is { type: "text"; text: string } => block.type === "text" && typeof block.text === "string")
		.map((block) => block.text)
		.join("\n");

	return text.trim() ? text : null;
}

function getLastAssistantMessage(ctx: ExtensionContext): LastAssistantMessage | null {
	const branch = ctx.sessionManager.getBranch() as SessionEntryLike[];
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type !== "message" || !entry.message) continue;
		const text = getAssistantMessageText(entry.message);
		if (text) return { entryId: entry.id, text };
	}
	return null;
}

function expandHome(path: string): string {
	if (path === "~") return process.env.HOME ?? path;
	if (path.startsWith("~/")) return join(process.env.HOME ?? "~", path.slice(2));
	return path;
}

function resolveAnnotatorPluginPath(): string | null {
	const candidates = [process.env.ANNOTATOR_NVIM_PATH, "~/dev/annotator.nvim"]
		.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
		.map((value) => resolve(expandHome(value.trim())));

	for (const candidate of candidates) {
		if (existsSync(join(candidate, "lua", "annotator", "init.lua"))) return candidate;
	}

	return null;
}

function splitCommand(command: string): string[] {
	const parts: string[] = [];
	let current = "";
	let quote: "'" | '"' | null = null;
	let escaped = false;

	for (const char of command) {
		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}
		if (char === "\\" && quote !== "'") {
			escaped = true;
			continue;
		}
		if ((char === "'" || char === '"') && quote === null) {
			quote = char;
			continue;
		}
		if (quote === char) {
			quote = null;
			continue;
		}
		if (/\s/.test(char) && quote === null) {
			if (current) parts.push(current);
			current = "";
			continue;
		}
		current += char;
	}

	if (escaped) current += "\\";
	if (current) parts.push(current);
	return parts;
}

function luaLongString(value: string): string {
	for (let level = 0; ; level++) {
		const equals = "=".repeat(level);
		const close = `]${equals}]`;
		if (!value.includes(close)) return `[${equals}[${value}]${equals}]`;
	}
}

function formatterLua(label: string | null): string {
	if (!label) return "";

	return `
    formatter = function(ctx)
      for _, annotation in ipairs(ctx.annotations) do
        annotation.relative_path = ${luaLongString(label)}
      end
      return ctx.default_format(ctx.annotations)
    end,`;
}

function buildNvimScript(options: { exportPath: string; pluginPath: string; pathLabel: string | null }): string {
	return `local export_path = ${luaLongString(options.exportPath)}
local plugin_path = ${luaLongString(options.pluginPath)}

vim.opt.runtimepath:prepend(plugin_path)

local ok, annotator = pcall(require, "annotator")
if not ok then
  vim.notify("annotator.nvim not found: " .. tostring(annotator), vim.log.levels.ERROR)
else
  annotator.setup({
    mappings = true,
    storage = "memory",${formatterLua(options.pathLabel)}
    hooks = {
      export = function(ctx)
        vim.fn.writefile(vim.split(ctx.markdown, "\\n", { plain = true }), export_path)
        ctx.clear_exported()
        ctx.notify("Saved annotations for Pi", "info")
      end,
    },
  })
end

local function write_annotations()
  if not ok then return end

  local rendered = annotator.render()
  if type(rendered) ~= "string" or not rendered:find("\\n## ", 1, true) then
    return
  end

  vim.fn.writefile(vim.split(rendered, "\\n", { plain = true }), export_path)
end

vim.api.nvim_create_autocmd("VimLeavePre", {
  once = true,
  callback = write_annotations,
})

vim.notify("Annotate, then :wq/ZZ. Pi sends annotations on return.", vim.log.levels.INFO)
`;
}

function getNvimCommand(): { command: string; args: string[] } {
	const parts = splitCommand(process.env.ANNOTATOR_NVIM ?? "nvim");
	return { command: parts[0] ?? "nvim", args: parts.slice(1) };
}

async function spawnInteractive(command: string, args: string[], cwd: string): Promise<{ code: number | null; error?: string }> {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd,
			stdio: "inherit",
			shell: process.platform === "win32",
		});
		child.on("error", (err) => resolve({ code: null, error: err.message }));
		child.on("close", (code) => resolve({ code }));
	});
}

async function openInNvim(
	ctx: ExtensionContext,
	request: NvimOpenRequest,
): Promise<{ code: number | null; error?: string } | undefined> {
	if (ctx.mode !== "tui") {
		throw new Error(`${request.label} is only available in Pi TUI mode.`);
	}

	return ctx.ui.custom<{ code: number | null; error?: string }>((tui, theme, _keybindings, done) => {
		let started = false;
		const { command, args: nvimArgs } = getNvimCommand();
		const component = new Text(theme.fg("accent", `Opening nvim for ${request.label}...`), 0, 0);

		const launch = async () => {
			if (started) return;
			started = true;
			let result: { code: number | null; error?: string } = { code: null, error: "nvim did not start" };
			try {
				tui.stop();
				process.stdout.write("Launching nvim. Pi will resume when nvim exits.\n");
				result = await spawnInteractive(command, [...nvimArgs, ...request.args], ctx.cwd);
			} finally {
				tui.start();
				tui.requestRender(true);
				done(result);
			}
		};

		setTimeout(() => void launch(), 0);
		return component;
	});
}

async function collectAnnotations(
	ctx: ExtensionContext,
	options: {
		tempPrefix: string;
		pathLabel: string | null;
		openArgs: (paths: { scriptPath: string; seedPath: string | null }) => string[];
		seedFile?: { name: string; content: string };
	},
): Promise<NvimResult> {
	const pluginPath = resolveAnnotatorPluginPath();
	if (!pluginPath) {
		return {
			feedback: "",
			error: "annotator.nvim not found. Set ANNOTATOR_NVIM_PATH to the plugin directory.",
		};
	}

	const dir = mkdtempSync(join(tmpdir(), options.tempPrefix));
	const exportPath = join(dir, "annotations.md");
	const scriptPath = join(dir, "annotator-pi.lua");

	try {
		const seedPath = options.seedFile ? join(dir, options.seedFile.name) : null;
		if (seedPath) {
			writeFileSync(seedPath, options.seedFile.content, "utf-8");
		}
		writeFileSync(scriptPath, buildNvimScript({ exportPath, pluginPath, pathLabel: options.pathLabel }), "utf-8");

		const result = await openInNvim(ctx, {
			label: options.pathLabel ?? "diff review",
			args: options.openArgs({ scriptPath, seedPath }),
		});
		if (!result) return { feedback: "", error: "nvim annotation UI did not return." };
		if (result.error) return { feedback: "", error: result.error, exitCode: result.code };
		if (result.code !== 0) return { feedback: "", error: `nvim exited with code ${result.code}.`, exitCode: result.code };

		const feedback = existsSync(exportPath) ? readFileSync(exportPath, "utf-8").trim() : "";
		return { feedback, exitCode: result.code };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function collectLastMessageAnnotations(ctx: ExtensionContext, markdown: string): Promise<NvimResult> {
	const content = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
	return collectAnnotations(ctx, {
		tempPrefix: "pi-annotator-last-nvim-",
		pathLabel: "last assistant message",
		seedFile: { name: "last-message.md", content },
		openArgs: ({ scriptPath, seedPath }) => ["-n", seedPath ?? "", "-c", `luafile ${scriptPath}`],
	});
}

async function collectReviewAnnotations(ctx: ExtensionContext): Promise<NvimResult> {
	return collectAnnotations(ctx, {
		tempPrefix: "pi-annotator-review-",
		pathLabel: null,
		openArgs: ({ scriptPath }) => ["-n", "-c", `luafile ${scriptPath}`, "-c", "CodeDiff"],
	});
}

function buildLastFeedbackMessage(feedback: string): string {
	return `Feedback on your previous response:\n\n${feedback}`;
}

function buildReviewFeedbackMessage(feedback: string): string {
	return `Feedback on current diff:\n\n${feedback}`;
}

export default function annotatorNvim(pi: ExtensionAPI): void {
	pi.registerCommand("annotator-last", {
		description: "Annotate the last assistant message in nvim",
		handler: async (_args, ctx) => {
			const snapshot = getLastAssistantMessage(ctx);
			if (!snapshot) {
				ctx.ui.notify("No assistant message found.", "error");
				return;
			}

			ctx.ui.notify("Opening nvim for last message...", "info");

			const result = await collectLastMessageAnnotations(ctx, snapshot.text);
			if (result.error) {
				ctx.ui.notify(`nvim annotation failed: ${result.error}`, "error");
				return;
			}
			if (!result.feedback) {
				ctx.ui.notify("Annotation closed (no feedback).", "info");
				return;
			}

			pi.sendUserMessage(buildLastFeedbackMessage(result.feedback));
		},
	});

	pi.registerCommand("annotator-review", {
		description: "Annotate current git diff in nvim",
		handler: async (_args, ctx) => {
			ctx.ui.notify("Opening nvim for diff review...", "info");

			const result = await collectReviewAnnotations(ctx);
			if (result.error) {
				ctx.ui.notify(`nvim review failed: ${result.error}`, "error");
				return;
			}
			if (!result.feedback) {
				ctx.ui.notify("Review closed (no feedback).", "info");
				return;
			}

			pi.sendUserMessage(buildReviewFeedbackMessage(result.feedback));
		},
	});
}
