local M = {}

function M.get(colors, opts)
  return {
    SpectreSearch = { bg = colors.red, fg = colors.bg },
    SpectreReplace = { bg = colors.green, fg = colors.bg },
  }
end

return M
