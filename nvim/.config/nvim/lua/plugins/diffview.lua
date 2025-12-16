return {
	"sindrets/diffview.nvim",
	cmd = { "DiffviewOpen", "DiffviewClose", "DiffviewFileHistory", "DiffviewToggleFiles" },
	keys = {
		{
			"<leader>gd",
			function()
				if next(require("diffview.lib").views) == nil then
					vim.cmd("DiffviewOpen")
				else
					vim.cmd("DiffviewClose")
				end
			end,
			desc = "Toggle Diffview",
		},
		{
			"<leader>gh",
			function()
				if next(require("diffview.lib").views) == nil then
					vim.cmd("DiffviewFileHistory %")
				else
					vim.cmd("DiffviewClose")
				end
			end,
			desc = "Toggle file history",
		},
	},
}
