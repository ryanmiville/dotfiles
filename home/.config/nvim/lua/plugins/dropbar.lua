return {
	"Bekaboo/dropbar.nvim",
	lazy = false,
	dependencies = {
		"nvim-tree/nvim-web-devicons",
	},
	opts = {},
	keys = {
		{
			"<leader>;",
			function()
				require("dropbar.api").pick()
			end,
			desc = "Pick breadcrumbs",
		},
		{
			"[;",
			function()
				require("dropbar.api").goto_context_start()
			end,
			desc = "Context start",
		},
		{
			"];",
			function()
				require("dropbar.api").select_next_context()
			end,
			desc = "Next context",
		},
	},
}
