return {
	"declancm/maximize.nvim",
	config = function()
		require("maximize").setup({
			plugins = {
				aerial = { enable = false }, -- enable aerial.nvim integration
				dapui = { enable = false }, -- enable nvim-dap-ui integration
				tree = { enable = false }, -- enable nvim-tree.lua integration
			},
		})
		vim.keymap.set("n", "<C-w>m", "<cmd>Maximize<CR>", { desc = "Toggle Maximize" })
	end,
}
