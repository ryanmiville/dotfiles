local M = {}

function M.get(colors, opts)
  return {
    Folded = { bg = colors.bg_highlight, fg = colors.blue },
    FoldColumn = { fg = colors.fg_gutter },
  }
end

return M
