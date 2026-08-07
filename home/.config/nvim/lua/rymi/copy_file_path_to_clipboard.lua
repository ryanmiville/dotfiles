vim.api.nvim_create_user_command("CopyFilePathToClipboard", function()
	-- Get the current buffer's file path
	local file_path = vim.fs.normalize(vim.api.nvim_buf_get_name(0))

	-- Keep the existing behavior of making paths relative to the cwd's parent.
	local project_root_parent_dir = vim.fs.dirname(vim.fs.normalize(vim.fn.getcwd()))
	local relative_path = vim.fs.relpath(project_root_parent_dir, file_path) or file_path

	-- Copy the relative path to the system clipboard
	vim.fn.setreg("+", relative_path)
end, {})

vim.api.nvim_create_user_command("CFP", function()
	vim.cmd(":CopyFilePathToClipboard")
end, {})
