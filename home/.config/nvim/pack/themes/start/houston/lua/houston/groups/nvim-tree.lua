local M = {}

function M.get(colors, opts)
  return {
    NvimTreeNormal = { bg = opts.transparent and colors.none or colors.bg_sidebar, fg = colors.fg },
    NvimTreeNormalNC = { bg = opts.transparent and colors.none or colors.bg_sidebar, fg = colors.fg },
    NvimTreeRootFolder = { fg = colors.purple, bold = true },
    NvimTreeGitDirty = { fg = colors.yellow },
    NvimTreeGitNew = { fg = colors.green },
    NvimTreeGitDeleted = { fg = colors.red },
    NvimTreeSpecialFile = { fg = colors.cyan, underline = true },
    NvimTreeIndentMarker = { fg = colors.fg_gutter },
    NvimTreeImageFile = { fg = colors.purple },
    NvimTreeSymlink = { fg = colors.cyan },
    NvimTreeFolderName = { fg = colors.blue },
    NvimTreeOpenedFolderName = { fg = colors.blue, bold = true },
    NvimTreeEmptyFolderName = { fg = colors.comment },
    NvimTreeFolderIcon = { fg = colors.blue },
    NvimTreeExecFile = { fg = colors.green },
    NvimTreeFileIcon = { fg = colors.fg },
  }
end

return M
