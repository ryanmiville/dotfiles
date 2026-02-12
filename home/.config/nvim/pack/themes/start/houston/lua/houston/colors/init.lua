local M = {}

---@param opts? houston.Config
function M.setup(opts)
  opts = require("houston.config").extend(opts)

  local palette = require("houston.colors.houston")

  ---@class ColorScheme: Palette
  local colors = vim.deepcopy(palette)

  colors.none = "NONE"

  -- Derived colors
  colors.diff = {
    add = "#1a3d33",
    delete = "#3d1f26",
    change = "#1a2d3d",
    text = "#54b9ff",
  }

  colors.border = "#343841"
  colors.border_highlight = "#54b9ff"

  colors.bg_popup = colors.bg_dark
  colors.bg_statusline = colors.bg_dark
  colors.bg_sidebar = colors.bg_dark
  colors.bg_float = colors.bg_dark

  colors.fg_sidebar = colors.fg_dark
  colors.fg_float = colors.fg

  colors.rainbow = {
    colors.blue,
    colors.cyan,
    colors.green,
    colors.yellow,
    colors.purple,
    colors.magenta,
  }

  -- Terminal colors
  colors.terminal = {
    black = "#17191e",
    black_bright = "#545864",
    red = "#dc3657",
    red_bright = "#f4587e",
    green = "#23d18b",
    green_bright = "#4bf3c8",
    yellow = "#ffc368",
    yellow_bright = "#ffd493",
    blue = "#2b7eca",
    blue_bright = "#54b9ff",
    magenta = "#ad5dca",
    magenta_bright = "#cc75f4",
    cyan = "#24c0cf",
    cyan_bright = "#00daef",
    white = "#eef0f9",
    white_bright = "#fafafa",
  }

  if opts.on_colors then
    opts.on_colors(colors)
  end

  return colors, opts
end

return M
