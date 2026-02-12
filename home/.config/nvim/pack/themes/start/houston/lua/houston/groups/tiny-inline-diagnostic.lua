local M = {}

function M.get(colors, opts)
  return {
    TinyInlineDiagnosticVirtualTextError = { fg = colors.error, bg = colors.bg },
    TinyInlineDiagnosticVirtualTextWarn = { fg = colors.warning, bg = colors.bg },
    TinyInlineDiagnosticVirtualTextInfo = { fg = colors.info, bg = colors.bg },
    TinyInlineDiagnosticVirtualTextHint = { fg = colors.hint, bg = colors.bg },
    TinyInlineDiagnosticError = { fg = colors.error },
    TinyInlineDiagnosticWarn = { fg = colors.warning },
    TinyInlineDiagnosticInfo = { fg = colors.info },
    TinyInlineDiagnosticHint = { fg = colors.hint },
  }
end

return M
