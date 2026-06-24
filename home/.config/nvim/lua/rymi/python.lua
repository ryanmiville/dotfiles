local M = {}

local uv = vim.uv or vim.loop

local uv_state_by_root = {}
local uv_pending_by_root = {}

local workspace_lockfiles = {
	"uv.lock",
	"poetry.lock",
	"pdm.lock",
	"Pipfile.lock",
}

local fallback_root_markers = {
	"pyrightconfig.json",
	"setup.py",
	"setup.cfg",
	"requirements.txt",
	"Pipfile",
	".git",
}

local function joinpath(...)
	return vim.fs.joinpath(...)
end

local function stat(path)
	return path and uv.fs_stat(path) or nil
end

local function is_file(path)
	local result = stat(path)
	return result and result.type == "file"
end

local function is_dir(path)
	local result = stat(path)
	return result and result.type == "directory"
end

local function read_file(path)
	local fd = uv.fs_open(path, "r", 0)
	if not fd then
		return nil
	end

	local file_stat = uv.fs_fstat(fd)
	local data = file_stat and uv.fs_read(fd, file_stat.size, 0) or nil
	uv.fs_close(fd)
	return data
end

local function ancestors(start_dir)
	local dirs = {}
	local dir = vim.fs.normalize(start_dir)

	while dir and dir ~= "" do
		table.insert(dirs, dir)

		local parent = vim.fs.dirname(dir)
		if not parent or parent == dir then
			break
		end
		dir = parent
	end

	return dirs
end

local function buffer_start_dir(bufnr)
	local name = vim.api.nvim_buf_get_name(bufnr)
	if name == "" then
		return uv.cwd()
	end

	if is_dir(name) then
		return name
	end

	return vim.fs.dirname(name)
end

local function has_any_lockfile(dir)
	for _, lockfile in ipairs(workspace_lockfiles) do
		if is_file(joinpath(dir, lockfile)) then
			return true
		end
	end

	return false
end

local function is_uv_project(root_dir)
	if is_file(joinpath(root_dir, "uv.lock")) then
		return true
	end

	local pyproject = read_file(joinpath(root_dir, "pyproject.toml"))
	return pyproject and pyproject:find("%[tool%.uv", 1, false) ~= nil
end

local function is_uv_workspace(root_dir)
	local pyproject = read_file(joinpath(root_dir, "pyproject.toml"))
	return pyproject and pyproject:find("%[tool%.uv%.workspace%]", 1, false) ~= nil
end

local function venv_from_python(python_path)
	local bin_dir = vim.fs.dirname(python_path)
	local venv_dir = bin_dir and vim.fs.dirname(bin_dir)

	if venv_dir and is_file(joinpath(venv_dir, "pyvenv.cfg")) then
		return venv_dir
	end

	return nil
end

local function venv_settings(root_dir, venv_dir)
	local parent = vim.fs.dirname(venv_dir)
	local name = vim.fs.basename(venv_dir)

	if not parent or not name then
		return nil
	end

	if vim.fs.normalize(parent) == vim.fs.normalize(root_dir) then
		parent = "."
	end

	return parent, name
end

function M.find_root(bufnr)
	local start_dir = buffer_start_dir(bufnr)
	if not start_dir then
		return nil
	end

	local innermost_pyproject = nil
	local outermost_workspace_root = nil

	for _, dir in ipairs(ancestors(start_dir)) do
		if is_file(joinpath(dir, "pyproject.toml")) then
			innermost_pyproject = innermost_pyproject or dir

			if has_any_lockfile(dir) or is_uv_workspace(dir) then
				outermost_workspace_root = dir
			end
		end
	end

	return outermost_workspace_root or innermost_pyproject or vim.fs.root(start_dir, fallback_root_markers)
end

local function notify_uv_failure(root_dir, result)
	local details = vim.trim((result.stderr or "") .. "\n" .. (result.stdout or ""))
	local message = "uv sync failed for " .. root_dir

	if details ~= "" then
		message = message .. "\n\n" .. details
	end

	vim.notify(message, vim.log.levels.WARN, { title = "Python LSP" })
end

local function uv_python_args(root_dir)
	local args = { "uv", "run", "--no-progress" }

	if is_file(joinpath(root_dir, "uv.lock")) then
		table.insert(args, "--frozen")
	end

	if is_uv_workspace(root_dir) then
		table.insert(args, "--all-packages")
	end

	vim.list_extend(args, {
		"python",
		"-c",
		"import sys; print(sys.executable)",
	})

	return args
end

function M.prepare_uv(root_dir, callback)
	if not root_dir or not is_uv_project(root_dir) or vim.fn.executable("uv") ~= 1 then
		callback(nil)
		return
	end

	if uv_state_by_root[root_dir] then
		callback(uv_state_by_root[root_dir])
		return
	end

	if uv_pending_by_root[root_dir] then
		table.insert(uv_pending_by_root[root_dir], callback)
		return
	end

	uv_pending_by_root[root_dir] = { callback }

	vim.system(uv_python_args(root_dir), { cwd = root_dir, text = true }, function(result)
		local python_path = result.code == 0 and vim.trim(result.stdout or "") or ""
		local state = {}

		if python_path ~= "" and is_file(python_path) then
			state.python_path = python_path
			state.venv_dir = venv_from_python(python_path)
		else
			state.error = result
			vim.schedule(function()
				notify_uv_failure(root_dir, result)
			end)
		end

		uv_state_by_root[root_dir] = state

		local callbacks = uv_pending_by_root[root_dir] or {}
		uv_pending_by_root[root_dir] = nil

		for _, done in ipairs(callbacks) do
			vim.schedule(function()
				done(state)
			end)
		end
	end)
end

function M.root_dir(bufnr, on_dir)
	local root_dir = M.find_root(bufnr)
	if not root_dir then
		return
	end

	M.prepare_uv(root_dir, function()
		on_dir(root_dir)
	end)
end

function M.basedpyright_settings()
	return {
		basedpyright = {
			analysis = {
				autoSearchPaths = true,
				diagnosticMode = "openFilesOnly",
				typeCheckingMode = "standard",
			},
			disableOrganizeImports = true,
		},
	}
end

function M.basedpyright_before_init(_, config)
	local state = config.root_dir and uv_state_by_root[config.root_dir] or nil
	if not state or not state.python_path then
		return
	end

	local settings = config.settings or {}
	config.settings = settings

	settings.python = settings.python or {}
	settings.python.pythonPath = settings.python.pythonPath or state.python_path
	settings.python.defaultInterpreterPath = settings.python.defaultInterpreterPath or state.python_path

	if state.venv_dir then
		local venv_path, venv = venv_settings(config.root_dir, state.venv_dir)

		if venv_path and venv then
			settings.venvPath = settings.venvPath or venv_path
			settings.venv = settings.venv or venv
			settings.python.venvPath = settings.python.venvPath or venv_path
			settings.python.venv = settings.python.venv or venv
		end
	end
end

return M
