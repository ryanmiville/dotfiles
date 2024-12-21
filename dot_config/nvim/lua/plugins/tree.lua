return {
	"kyazdani42/nvim-tree.lua",
	dependencies = {
		"kyazdani42/nvim-web-devicons",
	},
	lazy = false,
	keys = {
		{ "<leader>E", "<cmd>NvimTreeFindFile<cr>", desc = "Find file in file explorer" },
		{ "<C-n>", "<cmd>NvimTreeToggle<cr>", desc = "Toggle file explorer" },
	},
	opts = {
		filters = {
			custom = { ".git", "node_modules", ".vscode" },
			dotfiles = true,
		},
		git = {},
		view = {
			adaptive_size = true,
			side = "right",
			float = {
				enable = true,
			},
		},
	},
}
