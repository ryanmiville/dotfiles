local M = {}

function M.get(colors, opts)
  return {
    GitSignsAdd = { fg = colors.git.add, bg = opts.transparent and colors.none or colors.bg },
    GitSignsChange = { fg = colors.git.change, bg = opts.transparent and colors.none or colors.bg },
    GitSignsDelete = { fg = colors.git.delete, bg = opts.transparent and colors.none or colors.bg },
    GitSignsAddNr = { fg = colors.git.add, bg = opts.transparent and colors.none or colors.bg },
    GitSignsChangeNr = { fg = colors.git.change, bg = opts.transparent and colors.none or colors.bg },
    GitSignsDeleteNr = { fg = colors.git.delete, bg = opts.transparent and colors.none or colors.bg },
    GitSignsAddLn = { bg = colors.diff.add },
    GitSignsChangeLn = { bg = colors.diff.change },
    GitSignsDeleteLn = { bg = colors.diff.delete },
    GitSignsCurrentLineBlame = { fg = colors.comment },
    GitSignsAddPreview = { link = "DiffAdd" },
    GitSignsDeletePreview = { link = "DiffDelete" },
  }
end

return M
