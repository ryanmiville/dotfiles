local M = {}

function M.get(colors, opts)
  return {
    WhichKey = { fg = colors.cyan },
    WhichKeyGroup = { fg = colors.blue },
    WhichKeyDesc = { fg = colors.fg },
    WhichKeySeparator = { fg = colors.comment },
    WhichKeyFloat = { bg = opts.transparent and colors.none or colors.bg_float },
    WhichKeyBorder = { link = "FloatBorder" },
    WhichKeyValue = { fg = colors.comment },
  }
end

return M
