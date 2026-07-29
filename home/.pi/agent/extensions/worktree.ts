/**
 * Herdr Worktree Extension
 *
 * Creates a new git worktree via `herdr worktree create`, then relocates
 * the active pi session into it.
 *
 * Usage: /worktree <name>
 *
 * The <name> becomes both the branch name and the worktree path under
 * the herdr worktree location (~/.herdr/worktrees/<repo>/<name>).
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { readFile, unlink, writeFile } from "node:fs/promises";

interface WorktreeCreateResult {
	type: "worktree_created";
	workspace: {
		workspace_id: string;
		label: string;
	};
	worktree: {
		branch: string;
		path: string;
	};
}

interface HerdrResponse {
	id: string;
	result: WorktreeCreateResult;
	error?: { message: string };
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

export default function herdrWorktreeExtension(pi: ExtensionAPI) {
	pi.registerCommand("worktree", {
		description: "<name> — Create a herdr worktree and move the session there",
		handler: async (args, ctx) => {
			const name = args?.trim();
			if (!name) {
				ctx.ui.notify("Usage: /worktree <name>", "error");
				return;
			}

			if (!process.env.HERDR_ENV) {
				ctx.ui.notify("Not running inside herdr", "error");
				return;
			}

			const currentFile = ctx.sessionManager.getSessionFile();
			if (!currentFile) {
				ctx.ui.notify("Session is not persisted, cannot switch", "error");
				return;
			}

			await ctx.waitForIdle();

			// 1. Create the worktree via herdr CLI
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

			let parsed: HerdrResponse;
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

			const worktreePath = parsed.result.worktree.path;
			const branch = parsed.result.worktree.branch;
			const workspaceId = parsed.result.workspace.workspace_id;

			// 2. Relocate the session to the new worktree
			let newFile: string | undefined;
			try {
				const forked = SessionManager.forkFrom(currentFile, worktreePath);
				newFile = forked.getSessionFile();
				if (!newFile) {
					throw new Error("Failed to create forked session file");
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
						newCtx.ui.notify(
							`Worktree created: ${worktreePath} (branch: ${branch})`,
							"success",
						);

						try {
							await newCtx.sendUserMessage(
								`Session relocated to new worktree at ${worktreePath} on branch "${branch}". Continue working.`,
							);
						} catch {
							// user can prompt manually
						}
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
				// Clean up the herdr worktree since we couldn't switch
				await removeHerdrWorktree(pi, workspaceId, ctx.cwd);
				ctx.ui.notify(`Failed to switch worktree: ${err.message}`, "error");
			}
		},
	});
}
