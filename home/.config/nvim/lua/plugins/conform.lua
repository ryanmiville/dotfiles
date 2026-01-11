return {
	"stevearc/conform.nvim",
	event = { "BufWritePre" },
	cmd = { "ConformInfo" },
	opts = {
		notify_on_error = false,
		default_format_opts = {
			async = true,
			timeout_ms = 500,
			lsp_format = "fallback",
		},
		formatters_by_ft = {
			lua = { "stylua" },
			astro = { "biome", "prettierd", stop_after_first = true },
			javascript = { "biome", "prettierd", stop_after_first = true },
			typescript = { "biome", "prettierd", stop_after_first = true },
			typescriptreact = { "biome", "prettierd", stop_after_first = true },
		},
		format_on_save = {
			timeout_ms = 500,
			lsp_format = "fallback",
		},
		formatters = {
			biome = {
				condition = function(_, ctx)
					return vim.fs.find({ "biome.json", "biome.jsonc" }, {
						path = ctx.filename,
						upward = true,
						stop = vim.uv.os_homedir(),
					})[1] ~= nil
				end,
			},
			prettierd = {
				condition = function(_, ctx)
					return vim.fs.find({
						".prettierrc",
						".prettierrc.json",
						".prettierrc.js",
						".prettierrc.cjs",
						".prettierrc.mjs",
						"prettier.config.js",
						"prettier.config.cjs",
						"prettier.config.mjs",
					}, {
						path = ctx.filename,
						upward = true,
						stop = vim.uv.os_homedir(),
					})[1] ~= nil
				end,
			},
		},
	},
}
