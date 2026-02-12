local M = {}

function M.get(colors, opts)
  return {
    DiffviewNormal = { link = "Normal" },
    DiffviewStatusAdded = { fg = colors.git.add },
    DiffviewStatusModified = { fg = colors.git.change },
    DiffviewStatusDeleted = { fg = colors.git.delete },
    DiffviewStatusRenamed = { fg = colors.git.change },
    DiffviewStatusUntracked = { fg = colors.fg_gutter },
    DiffviewFilePanelInsertion = { fg = colors.git.add },
    DiffviewFilePanelDeletion = { fg = colors.git.delete },
    DiffviewFilePanelRootPath = { fg = colors.purple, bold = true },
    DiffviewFilePanelPath = { fg = colors.fg },
    DiffviewFilePanelTitle = { fg = colors.cyan, bold = true },
    DiffviewFilePanelCounter = { fg = colors.purple, bold = true },
  }
end

return M
