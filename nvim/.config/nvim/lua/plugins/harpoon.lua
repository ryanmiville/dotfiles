return {
	"ThePrimeagen/harpoon",
	branch = "harpoon2",

	dependencies = {
		"nvim-lua/plenary.nvim",
		"nvim-telescope/telescope.nvim",
	},
	keys = function()
		local harpoon = require("harpoon")

		return {
			{
				"<leader>a",
				function()
					harpoon:list():add()
				end,
				desc = "Add to harpoon",
			},
			{
				"<leader>1",
				function()
					harpoon:list():select(1)
				end,
				desc = "Go to 1",
			},
			{
				"<leader>2",
				function()
					harpoon:list():select(2)
				end,
				desc = "Go to 2",
			},
			{
				"<leader>3",
				function()
					harpoon:list():select(3)
				end,
				desc = "Go to 3",
			},
			{
				"<leader>4",
				function()
					harpoon:list():select(4)
				end,
				desc = "Go to 4",
			},
		}
	end,
	config = function()
		local harpoon = require("harpoon")
		harpoon:setup({})

		-- basic telescope configuration
		local conf = require("telescope.config").values
		local function toggle_telescope(harpoon_files)
			local file_paths = {}
			for _, item in ipairs(harpoon_files.items) do
				table.insert(file_paths, item.value)
			end

			require("telescope.pickers")
				.new({}, {
					prompt_title = "Harpoon",
					finder = require("telescope.finders").new_table({
						results = file_paths,
					}),
					previewer = conf.file_previewer({}),
					sorter = conf.generic_sorter({}),
				})
				:find()
		end
		vim.keymap.set("n", "<leader>h", function()
			harpoon.ui:toggle_quick_menu(harpoon:list())
		end)
		vim.keymap.set("n", "<leader>fH", function()
			toggle_telescope(harpoon:list())
		end, { desc = "Open harpoon window" })
	end,
}
