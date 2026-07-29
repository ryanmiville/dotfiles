/**
 * Herdr Worktree Extension
 *
 * /worktree <name>       — Create a new herdr worktree and move the session there.
 * /switch-worktree       — Pick an existing worktree from a list and move the session there.
 *
 * The <name> becomes both the branch name and the worktree path under
 * the herdr worktree location (~/.herdr/worktrees/<repo>/<name>).
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, SessionManager } from "@earendil-works/pi-coding-agent";
import {
	Container,
	fuzzyFilter,
	Input,
	type SelectItem,
	SelectList,
	Spacer,
	Text,
} from "@earendil-works/pi-tui";
import { readFile, stat, unlink, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";

// ── Herdr JSON response types ────────────────────────────────────

interface HerdrWorktree {
	branch: string;
	path: string;
	is_linked_worktree: boolean;
}

interface WorktreeCreateResult {
	type: "worktree_created";
	workspace: { workspace_id: string; label: string };
	worktree: HerdrWorktree;
}

interface WorktreeListResult {
	type: "worktree_list";
	worktrees: HerdrWorktree[];
}

interface HerdrResponse<T = unknown> {
	id: string;
	result: T;
	error?: { message: string };
}

// ── Helpers ──────────────────────────────────────────────────────

function ensureHerdr(ctx: ExtensionContext): boolean {
	if (!process.env.HERDR_ENV) {
		ctx.ui.notify("Not running inside herdr", "error");
		return false;
	}
	return true;
}

function ensureSession(ctx: ExtensionContext): string | undefined {
	const file = ctx.sessionManager.getSessionFile();
	if (!file) {
		ctx.ui.notify("Session is not persisted, cannot switch", "error");
	}
	return file;
}

async function removeHerdrWorktree(
	pi: ExtensionAPI,
	workspaceId: string,
	cwd: string,
): Promise<void> {
	try {
		await pi.exec("herdr", [
			"worktree", "remove",
			"--workspace", workspaceId,
			"--force",
		], { cwd, timeout: 15000 });
	} catch {
		// best-effort cleanup
	}
}

function createTargetSession(currentFile: string, worktreePath: string): SessionManager {
	try {
		return SessionManager.forkFrom(currentFile, worktreePath);
	} catch {
		// Fork fails on empty/new sessions — create a fresh one and
		// flush the header to disk (SessionManager.create defers writing
		// until the first assistant message, but switchSession needs
		// the file to exist).
		const sm = SessionManager.create(worktreePath);
		const file = sm.getSessionFile();
		const header = sm.getHeader();
		if (file && header) {
			writeFileSync(file, JSON.stringify(header) + "\n");
		}
		return sm;
	}
}

async function relocateSession(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	currentFile: string,
	worktreePath: string,
	branch: string,
	message: string,
): Promise<void> {
	let newFile: string | undefined;
	try {
		const target = createTargetSession(currentFile, worktreePath);
		newFile = target.getSessionFile();
		if (!newFile) {
			throw new Error("Failed to create target session file");
		}

		// Remove parentSession to avoid dangling reference
		const raw = await readFile(newFile, "utf8");
		const lines = raw.trimEnd().split("\n");
		if (lines.length > 0) {
			const header = JSON.parse(lines[0]);
			if (header.parentSession !== undefined) {
				delete header.parentSession;
				lines[0] = JSON.stringify(header);
				await writeFile(newFile, lines.join("\n") + "\n");
			}
		}

		const switchResult = await ctx.switchSession(newFile, {
			withSession: async (newCtx) => {
				try {
					await unlink(currentFile);
				} catch {
					// best-effort cleanup
				}
				newCtx.ui.notify(message, "success");
			},
		});

		if (switchResult.cancelled) {
			try {
				if (newFile) await unlink(newFile);
			} catch {
				// ignore
			}
			ctx.ui.notify("Worktree switch was cancelled", "info");
		}
	} catch (err: any) {
		if (newFile) {
			try {
				await unlink(newFile);
			} catch {
				// ignore
			}
		}
		throw err;
	}
}

// ── Extension ────────────────────────────────────────────────────

export default function herdrWorktreeExtension(pi: ExtensionAPI) {
	// /worktree <name> — create + switch
	pi.registerCommand("worktree", {
		description: "<name> — Create a herdr worktree and move the session there",
		handler: async (args, ctx) => {
			const name = args?.trim();
			if (!name) {
				ctx.ui.notify("Usage: /worktree <name>", "error");
				return;
			}
			if (!ensureHerdr(ctx)) return;
			const currentFile = ensureSession(ctx);
			if (!currentFile) return;

			await ctx.waitForIdle();

			ctx.ui.notify(`Creating worktree "${name}"…`, "info");

			const result = await pi.exec("herdr", [
				"worktree", "create",
				"--branch", name,
				"--no-focus",
				"--json",
			], { cwd: ctx.cwd, timeout: 15000 });

			if (result.code !== 0) {
				const stderr = result.stderr?.trim() || result.stdout?.trim() || "unknown error";
				ctx.ui.notify(`herdr worktree create failed: ${stderr}`, "error");
				return;
			}

			let parsed: HerdrResponse<WorktreeCreateResult>;
			try {
				parsed = JSON.parse(result.stdout.trim());
			} catch {
				ctx.ui.notify("Failed to parse herdr output", "error");
				return;
			}

			if (parsed.error) {
				ctx.ui.notify(`herdr error: ${parsed.error.message}`, "error");
				return;
			}

			const { path: worktreePath, branch } = parsed.result.worktree;
			const workspaceId = parsed.result.workspace.workspace_id;

			try {
				await relocateSession(
					pi, ctx, currentFile, worktreePath, branch,
					`Worktree created: ${worktreePath} (branch: ${branch})`,
				);
			} catch (err: any) {
				await removeHerdrWorktree(pi, workspaceId, ctx.cwd);
				ctx.ui.notify(`Failed to switch worktree: ${err.message}`, "error");
			}
		},
	});

	// /switch-worktree — pick from existing worktrees
	pi.registerCommand("switch-worktree", {
		description: "Pick an existing worktree and move the session there",
		handler: async (_args, ctx) => {
			if (!ensureHerdr(ctx)) return;
			const currentFile = ensureSession(ctx);
			if (!currentFile) return;

			// List worktrees via herdr
			const result = await pi.exec("herdr", [
				"worktree", "list", "--json",
			], { cwd: ctx.cwd, timeout: 10000 });

			if (result.code !== 0) {
				const stderr = result.stderr?.trim() || result.stdout?.trim() || "unknown error";
				ctx.ui.notify(`herdr worktree list failed: ${stderr}`, "error");
				return;
			}

			let parsed: HerdrResponse<WorktreeListResult>;
			try {
				parsed = JSON.parse(result.stdout.trim());
			} catch {
				ctx.ui.notify("Failed to parse herdr output", "error");
				return;
			}

			if (parsed.error) {
				ctx.ui.notify(`herdr error: ${parsed.error.message}`, "error");
				return;
			}

			const worktrees = parsed.result.worktrees;

			// Filter out the worktree we're already in
			const candidates = worktrees.filter((wt) => wt.path !== ctx.cwd);
			if (candidates.length === 0) {
				ctx.ui.notify("No other worktrees available", "info");
				return;
			}

			const items: SelectItem[] = candidates.map((wt) => ({
				value: wt.path,
				label: wt.branch,
				description: wt.path,
			}));

			const chosen = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
				const container = new Container();
				container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
				container.addChild(new Text(theme.fg("accent", theme.bold(" Switch worktree")), 0, 0));

				const searchInput = new Input();
				container.addChild(searchInput);
				container.addChild(new Spacer(1));

				const listContainer = new Container();
				container.addChild(listContainer);
				container.addChild(
					new Text(theme.fg("dim", "Type to filter • enter to select • esc to cancel"), 0, 0),
				);
				container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

				let filteredItems = items;
				let selectList: SelectList | null = null;

				const updateList = () => {
					listContainer.clear();
					if (filteredItems.length === 0) {
						listContainer.addChild(new Text(theme.fg("warning", "  No matching worktrees"), 0, 0));
						selectList = null;
						return;
					}

					selectList = new SelectList(filteredItems, Math.min(filteredItems.length, 12), {
						selectedPrefix: (text) => theme.fg("accent", text),
						selectedText: (text) => theme.fg("accent", text),
						description: (text) => theme.fg("dim", text),
						scrollInfo: (text) => theme.fg("dim", text),
						noMatch: (text) => theme.fg("warning", text),
					});

					selectList.onSelect = (item) => done(item.value as string);
					selectList.onCancel = () => done(null);
					listContainer.addChild(selectList);
				};

				const applyFilter = () => {
					const query = searchInput.getValue();
					filteredItems = query
						? fuzzyFilter(items, query, (item) => `${item.label} ${item.description ?? ""}`)
						: items;
					updateList();
				};

				applyFilter();

				return {
					render(width: number) {
						return container.render(width);
					},
					invalidate() {
						container.invalidate();
					},
					handleInput(data: string) {
						if (
							keybindings.matches(data, "tui.select.up") ||
							keybindings.matches(data, "tui.select.down") ||
							keybindings.matches(data, "tui.select.confirm") ||
							keybindings.matches(data, "tui.select.cancel")
						) {
							if (selectList) {
								selectList.handleInput(data);
							} else if (keybindings.matches(data, "tui.select.cancel")) {
								done(null);
							}
							tui.requestRender();
							return;
						}

						searchInput.handleInput(data);
						applyFilter();
						tui.requestRender();
					},
				};
			});

			if (!chosen) return;

			const selected = candidates.find((wt) => wt.path === chosen);
			if (!selected) return;

			await ctx.waitForIdle();

			try {
				await relocateSession(
					pi, ctx, currentFile, selected.path, selected.branch,
					`Switched to worktree: ${selected.path} (branch: ${selected.branch})`,
				);
			} catch (err: any) {
				ctx.ui.notify(`Failed to switch worktree: ${err.message}`, "error");
			}
		},
	});
}
