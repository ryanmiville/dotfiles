import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const DEFAULT_PROFILE = "dev";
const DEFAULT_REGION = "us-east-1";
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export default function (pi: ExtensionAPI) {
	process.env.AWS_PROFILE ??= DEFAULT_PROFILE;
	process.env.AWS_REGION ??= process.env.AWS_DEFAULT_REGION ?? DEFAULT_REGION;
	process.env.AWS_DEFAULT_REGION ??= process.env.AWS_REGION;
	let lastOkAt = 0;
	let inFlight: Promise<void> | undefined;
	let previousActiveTools: string[] | undefined;

	function isBedrock(ctx: ExtensionContext) {
		return ctx.model?.provider === "amazon-bedrock";
	}

	function applyBedrockToolNameLimit() {
		const active = pi.getActiveTools();
		const safe = active.filter((name) => name.length <= 64);
		if (safe.length === active.length) return;

		previousActiveTools ??= active;
		pi.setActiveTools(safe);
	}

	function restoreTools() {
		if (!previousActiveTools) return;
		pi.setActiveTools(previousActiveTools);
		previousActiveTools = undefined;
	}

	async function ensureAwsSso(ctx: ExtensionContext, force = false) {
		if (!isBedrock(ctx)) return;

		const now = Date.now();
		const ttlMs = Number(process.env.PI_AWS_SSO_CHECK_TTL_MS ?? DEFAULT_TTL_MS);
		if (!force && now - lastOkAt < ttlMs) return;

		if (!inFlight) {
			inFlight = (async () => {
				const profile = process.env.AWS_PROFILE ?? DEFAULT_PROFILE;
				const profileArgs = profile ? ["--profile", profile] : [];

				ctx.ui.setStatus("aws-sso", "checking");
				const check = await pi.exec("aws", ["sts", "get-caller-identity", ...profileArgs], {
					timeout: 15_000,
				});

				if (check.code !== 0) {
					ctx.ui.notify("AWS SSO expired; running aws sso login", "warning");
					ctx.ui.setStatus("aws-sso", "login");

					const login = await pi.exec("aws", ["sso", "login", ...profileArgs], {
						timeout: Number(process.env.PI_AWS_SSO_LOGIN_TIMEOUT_MS ?? 300_000),
					});

					if (login.code !== 0) {
						throw new Error((login.stderr || login.stdout || "aws sso login failed").trim());
					}
				}

				lastOkAt = Date.now();
				ctx.ui.setStatus("aws-sso", "ok");
			})().finally(() => {
				inFlight = undefined;
			});
		}

		await inFlight;
	}

	pi.on("before_agent_start", async (_event, ctx) => {
		if (isBedrock(ctx)) applyBedrockToolNameLimit();
		else restoreTools();
	});

	pi.on("model_select", async (_event, ctx) => {
		if (isBedrock(ctx)) applyBedrockToolNameLimit();
		else restoreTools();
	});

	pi.on("before_provider_request", async (event, ctx) => {
		await ensureAwsSso(ctx);

		// AWS Bedrock Converse rejects tool names >64 chars. Some extension/MCP tools
		// can exceed that, so prune them at the final payload boundary too.
		if (isBedrock(ctx) && event.payload?.toolConfig?.tools) {
			return {
				...event.payload,
				toolConfig: {
					...event.payload.toolConfig,
					tools: event.payload.toolConfig.tools.filter((tool: any) => {
						const name = tool?.toolSpec?.name ?? tool?.member?.toolSpec?.name;
						return typeof name !== "string" || name.length <= 64;
					}),
				},
			};
		}
	});

	pi.registerCommand("aws-sso", {
		description: "Check/refresh AWS SSO for Bedrock",
		handler: async (_args, ctx) => {
			try {
				await ensureAwsSso(ctx, true);
				ctx.ui.notify("AWS SSO ready", "info");
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});
}
