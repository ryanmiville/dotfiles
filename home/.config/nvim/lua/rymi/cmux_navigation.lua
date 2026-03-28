local uv = vim.uv or vim.loop

-- Smart split navigation for cmux.
-- Tries native nvim window moves first, then falls back to same-workspace cmux pane
-- focus by reading cmux's persisted split layout.
local M = {}

---@alias CmuxDirection "left"|"right"|"up"|"down"

---@class CmuxRect
---@field x number
---@field y number
---@field w number
---@field h number

---@class CmuxLeaf
---@field panel_ids string[]
---@field rect CmuxRect
---@field selected_panel_id string|nil

local defaults = {
	cmux_command = "cmux",
	keybindings = {},
	session_dir = vim.fn.expand("~") .. "/Library/Application Support/cmux",
	session_pattern = "session-*.json",
}

local config = vim.deepcopy(defaults)
local did_setup = false
local EPSILON = 1e-6

local window_moves = {
	left = "h",
	right = "l",
	up = "k",
	down = "j",
}

local function has_text(value)
	return type(value) == "string" and value ~= ""
end

local function clamp(value, min_value, max_value)
	return math.min(math.max(value, min_value), max_value)
end

local function stat_mtime(path)
	local stat = uv.fs_stat(path)
	if not stat or not stat.mtime then
		return 0
	end

	local seconds = stat.mtime.sec or stat.mtime.secs or 0
	local nanoseconds = stat.mtime.nsec or 0

	return (seconds * 1000000000) + nanoseconds
end

local function session_paths()
	local paths = vim.fn.glob(config.session_dir .. "/" .. config.session_pattern, false, true)

	table.sort(paths, function(left, right)
		return stat_mtime(left) > stat_mtime(right)
	end)

	return paths
end

local function read_json_file(path)
	local ok, lines = pcall(vim.fn.readfile, path)
	if not ok then
		return nil
	end

	local content = table.concat(lines, "\n")
	local decoded_ok, decoded = pcall(vim.json.decode, content)
	if not decoded_ok or type(decoded) ~= "table" then
		return nil
	end

	return decoded
end

local function workspace_has_surface(workspace, surface_id)
	for _, panel in ipairs(workspace.panels or {}) do
		if panel.id == surface_id then
			return true
		end
	end

	return false
end

local function find_workspace(surface_id)
	for _, path in ipairs(session_paths()) do
		local session = read_json_file(path)
		if type(session) == "table" then
			for _, window in ipairs(session.windows or {}) do
				local tab_manager = window.tabManager or {}
				for _, workspace in ipairs(tab_manager.workspaces or {}) do
					if workspace_has_surface(workspace, surface_id) then
						return workspace
					end
				end
			end
		end
	end

	return nil
end

---@param node table|nil
---@param rect CmuxRect
---@param leaves CmuxLeaf[]
local function collect_leaf_panes(node, rect, leaves)
	if type(node) ~= "table" then
		return
	end

	if node.type == "pane" and type(node.pane) == "table" then
		local panel_ids = {}
		for _, panel_id in ipairs(node.pane.panelIds or {}) do
			if has_text(panel_id) then
				table.insert(panel_ids, panel_id)
			end
		end

		local selected_panel_id = node.pane.selectedPanelId
		if not has_text(selected_panel_id) then
			selected_panel_id = panel_ids[1]
		end

		table.insert(leaves, {
			panel_ids = panel_ids,
			rect = rect,
			selected_panel_id = selected_panel_id,
		})

		return
	end

	if node.type ~= "split" or type(node.split) ~= "table" then
		return
	end

	local split = node.split
	local divider = clamp(tonumber(split.dividerPosition) or 0.5, 0, 1)

	if split.orientation == "horizontal" then
		collect_leaf_panes(split.first, {
			x = rect.x,
			y = rect.y,
			w = rect.w * divider,
			h = rect.h,
		}, leaves)
		collect_leaf_panes(split.second, {
			x = rect.x + (rect.w * divider),
			y = rect.y,
			w = rect.w * (1 - divider),
			h = rect.h,
		}, leaves)
		return
	end

	if split.orientation == "vertical" then
		collect_leaf_panes(split.first, {
			x = rect.x,
			y = rect.y,
			w = rect.w,
			h = rect.h * divider,
		}, leaves)
		collect_leaf_panes(split.second, {
			x = rect.x,
			y = rect.y + (rect.h * divider),
			w = rect.w,
			h = rect.h * (1 - divider),
		}, leaves)
	end
end

local function leaf_for_surface(leaves, surface_id)
	for _, leaf in ipairs(leaves) do
		for _, panel_id in ipairs(leaf.panel_ids) do
			if panel_id == surface_id then
				return leaf
			end
		end
	end

	return nil
end

local function interval_overlap(start_a, end_a, start_b, end_b)
	return math.max(0, math.min(end_a, end_b) - math.max(start_a, start_b))
end

local function point_interval_distance(point, start_value, end_value)
	if point < start_value then
		return start_value - point
	end

	if point > end_value then
		return point - end_value
	end

	return 0
end

local function current_anchor()
	local height = math.max(vim.fn.winheight(0), 1)
	local width = math.max(vim.fn.winwidth(0), 1)
	local row = clamp(vim.fn.winline(), 1, height)
	local column = clamp(vim.fn.wincol(), 1, width)

	return {
		x = clamp((column - 0.5) / width, 0, 1),
		y = clamp((row - 0.5) / height, 0, 1),
	}
end

---@param direction CmuxDirection
---@param current_rect CmuxRect
---@param candidate_rect CmuxRect
---@param anchor { x: number, y: number }
local function score_candidate(direction, current_rect, candidate_rect, anchor)
	local current_left = current_rect.x
	local current_right = current_rect.x + current_rect.w
	local current_top = current_rect.y
	local current_bottom = current_rect.y + current_rect.h
	local candidate_left = candidate_rect.x
	local candidate_right = candidate_rect.x + candidate_rect.w
	local candidate_top = candidate_rect.y
	local candidate_bottom = candidate_rect.y + candidate_rect.h
	local overlap = 0

	if direction == "left" then
		if candidate_right > current_left + EPSILON then
			return nil
		end

		overlap = interval_overlap(current_top, current_bottom, candidate_top, candidate_bottom)
		if overlap <= EPSILON then
			return nil
		end

		return {
			anchor_distance = point_interval_distance(anchor.y, candidate_top, candidate_bottom),
			center_distance = math.abs(((candidate_top + candidate_bottom) / 2) - anchor.y),
			main_gap = current_left - candidate_right,
			overlap = overlap,
		}
	end

	if direction == "right" then
		if candidate_left < current_right - EPSILON then
			return nil
		end

		overlap = interval_overlap(current_top, current_bottom, candidate_top, candidate_bottom)
		if overlap <= EPSILON then
			return nil
		end

		return {
			anchor_distance = point_interval_distance(anchor.y, candidate_top, candidate_bottom),
			center_distance = math.abs(((candidate_top + candidate_bottom) / 2) - anchor.y),
			main_gap = candidate_left - current_right,
			overlap = overlap,
		}
	end

	if direction == "up" then
		if candidate_bottom > current_top + EPSILON then
			return nil
		end

		overlap = interval_overlap(current_left, current_right, candidate_left, candidate_right)
		if overlap <= EPSILON then
			return nil
		end

		return {
			anchor_distance = point_interval_distance(anchor.x, candidate_left, candidate_right),
			center_distance = math.abs(((candidate_left + candidate_right) / 2) - anchor.x),
			main_gap = current_top - candidate_bottom,
			overlap = overlap,
		}
	end

	if direction == "down" then
		if candidate_top < current_bottom - EPSILON then
			return nil
		end

		overlap = interval_overlap(current_left, current_right, candidate_left, candidate_right)
		if overlap <= EPSILON then
			return nil
		end

		return {
			anchor_distance = point_interval_distance(anchor.x, candidate_left, candidate_right),
			center_distance = math.abs(((candidate_left + candidate_right) / 2) - anchor.x),
			main_gap = candidate_top - current_bottom,
			overlap = overlap,
		}
	end

	return nil
end

local function score_is_better(candidate, best)
	if best == nil then
		return true
	end

	if candidate.main_gap < best.main_gap - EPSILON then
		return true
	end

	if math.abs(candidate.main_gap - best.main_gap) > EPSILON then
		return false
	end

	if candidate.anchor_distance < best.anchor_distance - EPSILON then
		return true
	end

	if math.abs(candidate.anchor_distance - best.anchor_distance) > EPSILON then
		return false
	end

	if candidate.overlap > best.overlap + EPSILON then
		return true
	end

	if math.abs(candidate.overlap - best.overlap) > EPSILON then
		return false
	end

	if candidate.center_distance < best.center_distance - EPSILON then
		return true
	end

	if math.abs(candidate.center_distance - best.center_distance) > EPSILON then
		return false
	end

	return (candidate.selected_panel_id or "") < (best.selected_panel_id or "")
end

local function adjacent_leaf(leaves, current_leaf, direction)
	local cursor_anchor = current_anchor()
	local anchor = {
		x = current_leaf.rect.x + (current_leaf.rect.w * cursor_anchor.x),
		y = current_leaf.rect.y + (current_leaf.rect.h * cursor_anchor.y),
	}

	local best_score = nil
	local best_leaf = nil

	for _, leaf in ipairs(leaves) do
		if leaf ~= current_leaf and has_text(leaf.selected_panel_id) then
			local score = score_candidate(direction, current_leaf.rect, leaf.rect, anchor)
			if score ~= nil then
				score.selected_panel_id = leaf.selected_panel_id
				if score_is_better(score, best_score) then
					best_score = score
					best_leaf = leaf
				end
			end
		end
	end

	return best_leaf
end

local function run_command(args)
	if vim.system then
		local result = vim.system(args, { text = true }):wait()
		return result.code == 0
	end

	vim.fn.system(args)
	return vim.v.shell_error == 0
end

local function focus_panel(panel_id)
	local args = {
		config.cmux_command,
		"focus-panel",
	}

	if has_text(vim.env.CMUX_WORKSPACE_ID) then
		table.insert(args, "--workspace")
		table.insert(args, vim.env.CMUX_WORKSPACE_ID)
	end

	table.insert(args, "--panel")
	table.insert(args, panel_id)

	return run_command(args)
end

---@param direction CmuxDirection
function M.navigate(direction)
	local window_move = window_moves[direction]
	if window_move == nil then
		return false
	end

	local current_window = vim.api.nvim_get_current_win()
	pcall(vim.cmd.wincmd, window_move)
	if vim.api.nvim_get_current_win() ~= current_window then
		return true
	end

	local current_surface_id = vim.env.CMUX_SURFACE_ID
	if not has_text(current_surface_id) then
		return false
	end

	local workspace = find_workspace(current_surface_id)
	if type(workspace) ~= "table" or type(workspace.layout) ~= "table" then
		return false
	end

	local leaves = {}
	collect_leaf_panes(workspace.layout, {
		x = 0,
		y = 0,
		w = 1,
		h = 1,
	}, leaves)

	if #leaves == 0 then
		return false
	end

	local current_leaf = leaf_for_surface(leaves, current_surface_id)
	if current_leaf == nil then
		return false
	end

	local target_leaf = adjacent_leaf(leaves, current_leaf, direction)
	if target_leaf == nil or not has_text(target_leaf.selected_panel_id) then
		return false
	end

	return focus_panel(target_leaf.selected_panel_id)
end

function M.NvimCmuxNavigateLeft()
	return M.navigate("left")
end

function M.NvimCmuxNavigateDown()
	return M.navigate("down")
end

function M.NvimCmuxNavigateUp()
	return M.navigate("up")
end

function M.NvimCmuxNavigateRight()
	return M.navigate("right")
end

function M.setup(opts)
	config = vim.tbl_deep_extend("force", vim.deepcopy(defaults), opts or {})

	if did_setup then
		return
	end

	did_setup = true

	local commands = {
		Down = M.NvimCmuxNavigateDown,
		Left = M.NvimCmuxNavigateLeft,
		Right = M.NvimCmuxNavigateRight,
		Up = M.NvimCmuxNavigateUp,
	}

	for suffix, navigate in pairs(commands) do
		vim.api.nvim_create_user_command("NvimCmuxNavigate" .. suffix, function()
			navigate()
		end, {
			desc = "Navigate " .. string.lower(suffix) .. " across nvim splits and cmux panes",
		})
	end

	for direction, mapping in pairs(config.keybindings or {}) do
		local command = M["NvimCmuxNavigate" .. direction:gsub("^%l", string.upper)]
		if type(mapping) == "string" and type(command) == "function" then
			vim.keymap.set("n", mapping, command, { silent = true })
		end
	end
end

M._internal = {
	adjacent_leaf = adjacent_leaf,
	collect_leaf_panes = collect_leaf_panes,
	leaf_for_surface = leaf_for_surface,
	score_candidate = score_candidate,
}

return M
