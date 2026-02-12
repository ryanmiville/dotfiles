local M = {}

function M.get(colors, opts)
	local ret = {
		-- Notifier
		SnacksNotifierDebug = { fg = colors.fg, bg = opts.transparent and colors.none or colors.bg },
		SnacksNotifierBorderDebug = { fg = colors.comment, bg = opts.transparent and colors.none or colors.bg },
		SnacksNotifierIconDebug = { fg = colors.comment },
		SnacksNotifierTitleDebug = { fg = colors.comment },
		SnacksNotifierError = { fg = colors.fg, bg = opts.transparent and colors.none or colors.bg },
		SnacksNotifierBorderError = { fg = colors.error, bg = opts.transparent and colors.none or colors.bg },
		SnacksNotifierIconError = { fg = colors.error },
		SnacksNotifierTitleError = { fg = colors.error },
		SnacksNotifierInfo = { fg = colors.fg, bg = opts.transparent and colors.none or colors.bg },
		SnacksNotifierBorderInfo = { fg = colors.info, bg = opts.transparent and colors.none or colors.bg },
		SnacksNotifierIconInfo = { fg = colors.info },
		SnacksNotifierTitleInfo = { fg = colors.info },
		SnacksNotifierTrace = { fg = colors.fg, bg = opts.transparent and colors.none or colors.bg },
		SnacksNotifierBorderTrace = { fg = colors.purple, bg = opts.transparent and colors.none or colors.bg },
		SnacksNotifierIconTrace = { fg = colors.purple },
		SnacksNotifierTitleTrace = { fg = colors.purple },
		SnacksNotifierWarn = { fg = colors.fg, bg = opts.transparent and colors.none or colors.bg },
		SnacksNotifierBorderWarn = { fg = colors.warning, bg = opts.transparent and colors.none or colors.bg },
		SnacksNotifierIconWarn = { fg = colors.warning },
		SnacksNotifierTitleWarn = { fg = colors.warning },

		-- Dashboard
		SnacksDashboardDesc = { fg = colors.cyan },
		SnacksDashboardFooter = { fg = colors.blue },
		SnacksDashboardHeader = { fg = colors.purple, bold = true },
		SnacksDashboardIcon = { fg = colors.blue },
		SnacksDashboardKey = { fg = colors.yellow },
		SnacksDashboardSpecial = { fg = colors.magenta },
		SnacksDashboardDir = { fg = colors.fg_dark },

		-- Indent
		SnacksIndent = { fg = colors.fg_gutter },
		SnacksIndentScope = { fg = colors.cyan },

		-- Input (for rename, etc.)
		SnacksInputIcon = { fg = colors.cyan },
		SnacksInputBorder = { fg = colors.cyan },
		SnacksInputTitle = { fg = colors.cyan, bold = true },
		-- SnacksInputTitle = { fg = colors.cyan, bold = true, bg = colors.none },

		-- Picker

		SnacksPickerNormal = { bg = opts.transparent and colors.none or colors.bg_float, fg = colors.fg },
		SnacksPickerNormalNC = { bg = opts.transparent and colors.none or colors.bg_float, fg = colors.fg },
		SnacksPickerBorder = { fg = colors.border, bg = opts.transparent and colors.none or colors.bg_float },
		SnacksPickerTitle = {
			fg = colors.cyan,
			bg = opts.transparent and colors.none or colors.bg_float,
			bold = true,
		},
		SnacksPickerInputBorder = { fg = colors.cyan, bg = opts.transparent and colors.none or colors.bg_float },
		SnacksPickerInputTitle = {
			fg = colors.cyan,
			bg = opts.transparent and colors.none or colors.bg_float,
			bold = true,
		},
		SnacksPickerBoxTitle = {
			fg = colors.cyan,
			bg = opts.transparent and colors.none or colors.bg_float,
			bold = true,
		},
		SnacksPickerList = { bg = opts.transparent and colors.none or colors.bg_float },
		SnacksPickerListBorder = { fg = colors.border, bg = opts.transparent and colors.none or colors.bg_float },
		SnacksPickerPreview = { bg = opts.transparent and colors.none or colors.bg_float },
		SnacksPickerPreviewBorder = { fg = colors.border, bg = opts.transparent and colors.none or colors.bg_float },
		SnacksPickerPrompt = { fg = colors.cyan, bg = opts.transparent and colors.none or colors.bg_float, bold = true },
		SnacksPickerMatch = { fg = colors.yellow, bold = true },
		SnacksPickerSelected = { fg = colors.magenta, bold = true },
		SnacksPickerCursorLine = { bg = colors.bg_highlight },
		SnacksPickerToggle = { fg = colors.comment },
		SnacksPickerPickWin = { fg = colors.fg, bg = colors.bg_search, bold = true },
		SnacksPickerPickWinCurrent = { fg = colors.bg, bg = colors.cyan, bold = true },
		-- Git
		SnacksGitBranch = { fg = colors.magenta, bold = true },
		SnacksGitIcon = { fg = colors.cyan },
	}

	-- Indent rainbow colors
	for i, color in ipairs(colors.rainbow) do
		ret["SnacksIndent" .. i] = { fg = color }
	end

	return ret
end

return M
