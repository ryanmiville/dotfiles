local filtered_message = { "No information available" }

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
			style = "fancy",
		},
		picker = {
			enabled = true,
			sources = {
				files = {
					hidden = true,
				},
			},
		},
		quickfile = { enabled = true },
		rename = { enabled = true },
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
		toggle = { enabled = true },
		words = { enabled = false },
		-- styles = {
		-- 	notification = {
		-- 		-- wo = { wrap = true } -- Wrap notifications
		-- 	},
		-- },
	},
	keys = {
		{
			"<leader>f",
			function()
				Snacks.picker.files()
			end,
			desc = "File picker",
		},
		{
			"<leader>s",
			function()
				Snacks.picker.lsp_symbols()
			end,
			desc = "LSP symbols",
		},
		{
			"<leader>S",
			function()
				Snacks.picker.lsp_workspace_symbols()
			end,
			desc = "LSP workspace symbols",
		},
		{
			"<leader>/",
			function()
				Snacks.picker.grep()
			end,
			desc = "Grep",
		},
		{
			"<leader><Tab>",
			function()
				Snacks.picker.recent({ filter = { cwd = true } })
			end,
			desc = "Recent",
		},
		{
			"<leader>gs",
			function()
				Snacks.picker.git_status()
			end,
			desc = "Git Status",
		},
		{
			"<leader>nc",
			function()
				Snacks.picker.files({ cwd = vim.fn.stdpath("config") })
			end,
			desc = "Find config file",
		},
		{
			"<leader>.",
			function()
				Snacks.scratch()
			end,
			desc = "Toggle scratch buffer",
		},
		{
			"<leader>N",
			function()
				Snacks.notifier.show_history()
			end,
			desc = "Notification history",
		},
		{
			"<leader>x",
			function()
				Snacks.bufdelete()
			end,
			desc = "Quit buffer",
		},
		{
			"<leader>bo",
			function()
				Snacks.bufdelete.other()
			end,
			desc = "Close all other buffers",
		},
		{
			"<leader>gB",
			function()
				Snacks.gitbrowse()
			end,
			desc = "Git browse",
			mode = { "n", "v" },
		},
		-- {
		-- 	"<leader>gb",
		-- 	function()
		-- 		Snacks.git.blame_line()
		-- 	end,
		-- 	desc = "Git Blame Line",
		-- },
		{
			"<leader>gf",
			function()
				Snacks.lazygit.log_file()
			end,
			desc = "Lazygit current file history",
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
			desc = "Lazygit log (cwd)",
		},
		{
			"<leader>td",
			function()
				Snacks.toggle.diagnostics():toggle()
			end,
			desc = "[T]oggle [D]iagnostics",
		},
		{
			"<leader>tw",
			function()
				Snacks.toggle.option("wrap"):toggle()
			end,
			desc = "[T]oggle line [W]rap",
		},
		{
			"<leader>un",
			function()
				Snacks.notifier.hide()
			end,
			desc = "Dismiss all notifications",
		},
	},
	init = function()
		vim.api.nvim_create_autocmd("User", {
			pattern = "VeryLazy",
			callback = function()
				local notify = Snacks.notifier.notify
				---@diagnostic disable-next-line: duplicate-set-field
				Snacks.notifier.notify = function(message, level, opts)
					for _, msg in ipairs(filtered_message) do
						if message == msg then
							return nil
						end
					end
					return notify(message, level, opts)
				end
			end,
		})

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

		vim.api.nvim_create_autocmd("User", {
			pattern = "OilActionsPost",
			callback = function(event)
				if event.data.actions.type == "move" then
					Snacks.rename.on_rename_file(event.data.actions.src_url, event.data.actions.dest_url)
				end
			end,
		})
	end,
}
