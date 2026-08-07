return {
	{
		"nvim-tree/nvim-web-devicons",
		event = "VeryLazy",
		opts = {},
		config = function()
			require("nvim-web-devicons").setup({
				override = {
					gleam = {
						icon = "",
						color = "#ffaff3",
						name = "Gleam",
					},
				},
			})
		end,
	},
}
