return {
	{
		"echasnovski/mini.nvim",
		config = function()
			require("mini.extra").setup()
			local ai = require("mini.ai")
			ai.setup({
				custom_textobjects = {
					B = MiniExtra.gen_ai_spec.buffer(),
					i = MiniExtra.gen_ai_spec.indent(),
				},
			})
			require("mini.surround").setup({
				mappings = {
					add = "S", -- Add surrounding in Normal and Visual modes
					delete = "ds", -- Delete surrounding
					find = "sf", -- Find surrounding (to the right)
					find_left = "sF", -- Find surrounding (to the left)
					highlight = "sh", -- Highlight surrounding
					replace = "cs", -- Replace surrounding
					update_n_lines = "sn", -- Update `n_lines`

					suffix_last = "l", -- Suffix to search with "prev" method
					suffix_next = "n", -- Suffix to search with "next" method
				},
			})
			require("mini.sessions").setup()
		end,
	},
}
