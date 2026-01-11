vim.api.nvim_create_autocmd("FileType", {
	pattern = "oil",
	callback = function()
		vim.opt_local.colorcolumn = ""
	end,
})

return {
	"stevearc/oil.nvim",
	---@module 'oil'
	---@type oil.SetupOpts
	opts = {},
	-- Optional dependencies
	-- dependencies = { { "echasnovski/mini.icons", opts = {} } },
	dependencies = { "nvim-tree/nvim-web-devicons" }, -- use if prefer nvim-web-devicons
	config = function()
		require("oil").setup({
			default_file_explorer = true,
			skip_confirm_for_simple_edits = true,
			view_options = {
				show_hidden = true,
				natural_order = true,
				-- is_always_hidden = function(name, _)
				-- 	return name == ".." or name == ".git"
				-- end,
			},
			confirmation = {
				boarder = "rounded",
			},
			float = {
				boarder = "rounded",
				-- padding = 2,
				-- max_width = 90,
				-- max_height = 0,
			},
			keymaps = {
				["<C-r>"] = "actions.refresh",
				["q"] = { "actions.close", mode = "n" },
				["<BS>"] = { "actions.parent", mode = "n" },
			},
		})
		vim.keymap.set("n", "-", "<CMD>Oil --float<CR>", { desc = "Open parent directory" })
	end,
}
