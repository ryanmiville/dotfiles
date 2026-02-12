local M = {}

function M.get(colors, opts)
  return {
    TodoBgFIX = { bg = colors.error, fg = colors.bg, bold = true },
    TodoFgFIX = { fg = colors.error },
    TodoSignFIX = { fg = colors.error },
    TodoBgTODO = { bg = colors.info, fg = colors.bg, bold = true },
    TodoFgTODO = { fg = colors.info },
    TodoSignTODO = { fg = colors.info },
    TodoBgHACK = { bg = colors.warning, fg = colors.bg, bold = true },
    TodoFgHACK = { fg = colors.warning },
    TodoSignHACK = { fg = colors.warning },
    TodoBgWARN = { bg = colors.warning, fg = colors.bg, bold = true },
    TodoFgWARN = { fg = colors.warning },
    TodoSignWARN = { fg = colors.warning },
    TodoBgPERF = { bg = colors.purple, fg = colors.bg, bold = true },
    TodoFgPERF = { fg = colors.purple },
    TodoSignPERF = { fg = colors.purple },
    TodoBgNOTE = { fg = colors.hint, fg = colors.bg, bold = true },
    TodoFgNOTE = { fg = colors.hint },
    TodoSignNOTE = { fg = colors.hint },
    TodoBgTEST = { fg = colors.green, fg = colors.bg, bold = true },
    TodoFgTEST = { fg = colors.green },
    TodoSignTEST = { fg = colors.green },
  }
end

return M
