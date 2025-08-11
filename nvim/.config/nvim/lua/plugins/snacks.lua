return {
	"folke/snacks.nvim",
	priority = 1000,
	lazy = false,
	---@type snacks.Config
	opts = {
		bigfile = { enabled = true },
		dashboard = { enabled = true },
		indent = {
			enabled = true,
			animate = { enabled = false },
		},
		input = { enabled = true },
		notifier = {
			enabled = true,
			timeout = 3000,
		},
		pickers = {
			enabled = true,
		},
		quickfile = { enabled = true },
		statuscolumn = {
			enabled = true,
			left = { "mark", "fold" }, -- priority of signs on the left (high to low)
			right = { "git" }, -- priority of signs on the right (high to low)
			folds = {
				open = true, -- show open fold icons
				git_hl = true, -- use Git Signs hl for fold icons
			},
			git = {
				-- patterns to match Git signs
				patterns = { "GitSign" },
			},
		},
		words = { enabled = false },
		styles = {
			notification = {
				-- wo = { wrap = true } -- Wrap notifications
			},
		},
	},
	keys = {
		{
			"<leader>f",
			function()
				Snacks.picker.smart()
			end,
			desc = "File Picker",
		},
		{
			"<leader>.",
			function()
				Snacks.scratch()
			end,
			desc = "Toggle Scratch Buffer",
		},
		{
			"<leader>n",
			function()
				Snacks.notifier.show_history()
			end,
			desc = "Notification History",
		},
		{
			"<leader>bd",
			function()
				Snacks.bufdelete()
			end,
			desc = "Delete Buffer",
		},
		{
			"<leader>bo",
			function()
				Snacks.bufdelete.other()
			end,
			desc = "Delete Buffer",
		},
		{
			"<leader>gB",
			function()
				Snacks.gitbrowse()
			end,
			desc = "Git Browse",
			mode = { "n", "v" },
		},
		{
			"<leader>gb",
			function()
				Snacks.git.blame_line()
			end,
			desc = "Git Blame Line",
		},
		{
			"<leader>gf",
			function()
				Snacks.lazygit.log_file()
			end,
			desc = "Lazygit Current File History",
		},
		{
			"<leader>gg",
			function()
				Snacks.lazygit()
			end,
			desc = "Lazygit",
		},
		{
			"<leader>gl",
			function()
				Snacks.lazygit.log()
			end,
			desc = "Lazygit Log (cwd)",
		},
		{
			"<leader>un",
			function()
				Snacks.notifier.hide()
			end,
			desc = "Dismiss All Notifications",
		},
	},
	init = function()
		vim.api.nvim_create_autocmd("User", {
			pattern = "VeryLazy",
			callback = function()
				-- Setup some globals for debugging (lazy-loaded)
				_G.dd = function(...)
					Snacks.debug.inspect(...)
				end
				_G.bt = function()
					Snacks.debug.backtrace()
				end
				vim.print = _G.dd -- Override print to use snacks for `:=` command

				-- Create some toggle mappings
				-- Snacks.toggle.option("spell", { name = "Spelling" }):map("<leader>us")
				-- Snacks.toggle.option("wrap", { name = "Wrap" }):map("<leader>uw")
				-- Snacks.toggle.option("relativenumber", { name = "Relative Number" }):map("<leader>uL")
				-- Snacks.toggle.diagnostics():map("<leader>ud")
				-- Snacks.toggle.line_number():map("<leader>ul")
				-- Snacks.toggle
				--     .option("conceallevel", { off = 0, on = vim.o.conceallevel > 0 and vim.o.conceallevel or 2 })
				--     :map("<leader>uc")
				-- Snacks.toggle.treesitter():map("<leader>uT")
				-- Snacks.toggle
				--     .option("background", { off = "light", on = "dark", name = "Dark Background" })
				--     :map("<leader>ub")
				-- Snacks.toggle.inlay_hints():map("<leader>uh")
				-- Snacks.toggle.indent():map("<leader>ug")
				-- Snacks.toggle.dim():map("<leader>uD")
			end,
		})
	end,
}
