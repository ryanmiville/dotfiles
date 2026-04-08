return {
	{
		"catppuccin/nvim",
		name = "catppuccin",
		lazy = false,
		priority = 1000,
		config = function()
			require("catppuccin").setup({
				integrations = {
					diffview = true,
					fidget = true,
					gitsigns = true,
					harpoon = true,
					native_lsp = { enabled = true },
					render_markdown = true,
					snacks = {
						enabled = true,
						indent_scope_color = "mauve",
					},
					treesitter = true,
					treesitter_context = true,
					ufo = true,
					which_key = true,
				},
			})
			vim.cmd.colorscheme("catppuccin-macchiato")

			-- Hide all semantic highlights until upstream issues are resolved
			for _, group in ipairs(vim.fn.getcompletion("@lsp", "highlight")) do
				vim.api.nvim_set_hl(0, group, {})
			end
		end,
	},
}
