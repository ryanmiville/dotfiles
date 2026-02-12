---@type Palette
return {
  -- Background colors
  bg = "#17191e",
  bg_dark = "#23262d",
  bg_highlight = "#23262d",
  bg_visual = "#4b3058",
  bg_search = "#515c6a",

  -- Foreground colors
  fg = "#eef0f9",
  fg_dark = "#bfc1c9",
  fg_gutter = "#545864",

  -- Accent colors (from Houston theme)
  blue = "#54b9ff",         -- Keywords, tags
  cyan = "#00daef",         -- Functions, methods
  green = "#4bf3c8",        -- Variables, attributes
  yellow = "#ffd493",       -- Strings, constants
  purple = "#acafff",       -- Types, classes
  magenta = "#cc75f4",      -- Accent/magic
  red = "#f4587e",          -- Errors, deleted
  orange = "#ff8551",       -- Warnings

  -- Semantic colors
  comment = "#545864",
  dark3 = "#858b98",
  dark5 = "#bfc1c9",
  terminal_black = "#343841",

  -- UI colors
  error = "#f4587e",
  warning = "#fbc23b",
  info = "#54b9ff",
  hint = "#00daef",

  -- Git colors
  git = {
    add = "#4bf3c8",
    change = "#54b9ff",
    delete = "#f4587e",
  },
}
