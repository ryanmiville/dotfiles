return {
	{
		"gelguy/wilder.nvim",
		keys = {
			":",
			"/",
			"?",
		},
		dependencies = {
			"folke/tokyonight.nvim",
		},
		build = function()
			vim.fn["UpdateRemotePlugins"]()
		end,
		config = function()
			local wilder = require("wilder")
			local colors = require("tokyonight.colors").setup()

			-- local macchiato = require("catppuccin.palettes").get_palette("macchiato")

			-- Create a highlight group for the popup menu
			local text_highlight = wilder.make_hl("WilderText", { { a = 1 }, { a = 1 }, { foreground = colors.fg } })
			local blue2_highlight =
				wilder.make_hl("WilderBlue", { { a = 1 }, { a = 1 }, { foreground = colors.blue2 } })

			-- Enable wilder when pressing :, / or ?
			wilder.setup({
				modes = { ":", "/", "?" },
				next_key = "<C-n>",
				previous_key = "<C-p>",
			})

			-- Enable fuzzy matching for commands and buffers
			wilder.set_option("pipeline", {
				wilder.branch(
					wilder.cmdline_pipeline({
						fuzzy = 1,
					}),
					wilder.vim_search_pipeline({
						fuzzy = 1,
					})
				),
			})

			wilder.set_option(
				"renderer",
				wilder.popupmenu_renderer(wilder.popupmenu_border_theme({
					highlighter = wilder.basic_highlighter(),
					highlights = {
						default = text_highlight,
						border = blue2_highlight,
						accent = blue2_highlight,
					},
					pumblend = 5,
					-- min_width = "100%",
					min_height = "25%",
					max_height = "25%",
					border = "rounded",
					left = { " ", wilder.popupmenu_devicons() },
					right = { " ", wilder.popupmenu_scrollbar() },
				}))
			)
		end,
	},
}
