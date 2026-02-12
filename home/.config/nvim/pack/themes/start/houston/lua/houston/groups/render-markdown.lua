local M = {}

function M.get(colors, opts)
  return {
    RenderMarkdownCode = { bg = colors.bg_highlight },
    RenderMarkdownCodeInline = { bg = colors.bg_highlight },
    RenderMarkdownBullet = { fg = colors.cyan },
    RenderMarkdownTableHead = { fg = colors.cyan },
    RenderMarkdownTableRow = { fg = colors.fg },
    RenderMarkdownSuccess = { fg = colors.green },
    RenderMarkdownInfo = { fg = colors.blue },
    RenderMarkdownHint = { fg = colors.cyan },
    RenderMarkdownWarn = { fg = colors.yellow },
    RenderMarkdownError = { fg = colors.red },
    RenderMarkdownDash = { fg = colors.cyan },
  }
end

return M
