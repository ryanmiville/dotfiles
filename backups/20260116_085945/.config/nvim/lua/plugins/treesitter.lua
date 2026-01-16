return {
	{
		"nvim-treesitter/nvim-treesitter",
		build = function()
			require("nvim-treesitter.install").update({ with_sync = true })
		end,
		event = { "BufEnter" },
		main = "nvim-treesitter.configs", -- Sets main module to use for opts
		-- [[ Configure Treesitter ]] See `:help nvim-treesitter`
		opts = {
			ensure_installed = {
				"bash",
				"css",
				"gleam",
				"go",
				"html",
				"javascript",
				"json",
				"lua",
				"luadoc",
				"markdown",
				"markdown_inline",
				"python",
				"rust",
				"terraform",
				"tsx",
				"typescript",
				"yaml",
				-- "scala"
			},
			sync_install = false,
			auto_install = true,
			highlight = {
				enable = true,
			},
			indent = { enable = true },
			autopairs = { enable = true },
			autotag = { enable = true },
			incremental_selection = { 
				enable = true,
				keymaps = {
					init_selection = "<c-space>",
					node_incremental = "<c-space>",
					scope_incremental = "<c-s>",
					node_decremental = "<c-backspace>",
				}

			},
		},
	},
	{
		-- Additional text objects for treesitter
		"nvim-treesitter/nvim-treesitter-textobjects",
		dependencies = { "nvim-treesitter/nvim-treesitter" },
	},
	{
		"nvim-treesitter/nvim-treesitter-context",
		dependencies = { "nvim-treesitter/nvim-treesitter" },
	},
}
