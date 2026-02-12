local M = {}

function M.get(colors, opts)
  return {
    FidgetTitle = { fg = colors.cyan, bold = true },
    FidgetTask = { fg = colors.fg },
  }
end

return M
