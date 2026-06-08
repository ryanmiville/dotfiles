local parser_languages = {
	"bash",
	"css",
	"gleam",
	"go",
	"html",
	"javascript",
	"json",
	"lua",
	"luadoc",
	"markdown",
	"markdown_inline",
	"python",
	"query",
	"rust",
	"terraform",
	"tsx",
	"typescript",
	"vim",
	"vimdoc",
	"yaml",
}

local parser_filetypes = {
	"bash",
	"css",
	"gleam",
	"go",
	"html",
	"javascript",
	"json",
	"lua",
	"luadoc",
	"markdown",
	"python",
	"query",
	"rust",
	"sh",
	"terraform",
	"tsx",
	"typescript",
	"vim",
	"vimdoc",
	"yaml",
}

local function install_missing_parsers()
	local treesitter = require("nvim-treesitter")
	local installed = {}

	for _, language in ipairs(treesitter.get_installed()) do
		installed[language] = true
	end

	local missing = vim.tbl_filter(function(language)
		return not installed[language]
	end, parser_languages)

	if #missing > 0 then
		treesitter.install(missing)
	end
end

local function start_treesitter()
	vim.api.nvim_create_autocmd("FileType", {
		pattern = parser_filetypes,
		callback = function()
			vim.treesitter.start()
		end,
	})
end

return {
	{
		"nvim-treesitter/nvim-treesitter",
		branch = "main",
		lazy = false,
		build = ":TSUpdate",
		config = function()
			install_missing_parsers()
			start_treesitter()
		end,
	},
	{
		"nvim-treesitter/nvim-treesitter-textobjects",
		branch = "main",
		dependencies = { "nvim-treesitter/nvim-treesitter" },
		config = function()
			require("nvim-treesitter-textobjects").setup({
				select = {
					lookahead = true,
				},
				move = {
					set_jumps = true,
				},
			})
		end,
	},
	{
		"nvim-treesitter/nvim-treesitter-context",
		dependencies = { "nvim-treesitter/nvim-treesitter" },
		config = function()
			require("treesitter-context").setup({
				enable = false,
				max_lines = 1,
				trim_scope = "inner",
			})
		end,
	},
}
