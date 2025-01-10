return {
	"NeogitOrg/neogit",
	dependencies = {
		"nvim-lua/plenary.nvim", -- required
		"sindrets/diffview.nvim", -- optional - Diff integration

		-- Only one of these is needed.
		"nvim-telescope/telescope.nvim",
	},
	config = function()
		require("neogit")
		vim.keymap.set("n", "<leader>gd", ":DiffviewOpen<CR>", { silent = true, noremap = true })
	end,
}
