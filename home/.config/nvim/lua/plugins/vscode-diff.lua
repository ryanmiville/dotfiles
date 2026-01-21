return {
	"esmuellert/codediff.nvim",
	dependencies = { "MunifTanjim/nui.nvim" },
	cmd = "CodeDiff",
	keys = {
		{ "<leader>gd", "<cmd>CodeDiff<cr>", desc = "CodeDiff" },
		{ "<leader>gh", "<cmd>CodeDiff history<cr>", desc = "CodeDiff history" },
	},
}
