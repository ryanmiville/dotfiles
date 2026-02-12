local M = {}

function M.get(colors, opts)
  return {
    OilDir = { fg = colors.blue },
    OilDirIcon = { fg = colors.blue },
    OilFile = { fg = colors.fg },
    OilLink = { fg = colors.cyan, underline = true },
    OilLinkTarget = { fg = colors.comment },
    OilCopy = { fg = colors.green },
    OilMove = { fg = colors.yellow },
    OilChange = { fg = colors.yellow },
    OilCreate = { fg = colors.green },
    OilDelete = { fg = colors.red },
    OilPermissionNone = { fg = colors.comment },
    OilPermissionRead = { fg = colors.yellow },
    OilPermissionWrite = { fg = colors.red },
    OilPermissionExecute = { fg = colors.green },
  }
end

return M
