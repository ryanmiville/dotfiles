local M = {}

function M.get(colors, opts)
  return {
    HopNextKey = { fg = colors.cyan, bold = true, underline = true },
    HopNextKey1 = { fg = colors.cyan, bold = true },
    HopNextKey2 = { fg = colors.blue },
    HopUnmatched = { fg = colors.comment },
  }
end

return M
