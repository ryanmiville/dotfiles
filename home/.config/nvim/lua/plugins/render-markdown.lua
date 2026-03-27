return {
	"MeanderingProgrammer/render-markdown.nvim",
	opts = {
		code = {
			sign = false,
			width = "block",
			right_pad = 1,
		},
		heading = {
			sign = false,
			icons = {},
		},
		overrides = {
			buftype = {
				nofile = {
					enabled = false,
				},
			},
		},
	},
	dependencies = { "nvim-treesitter/nvim-treesitter" },
}
