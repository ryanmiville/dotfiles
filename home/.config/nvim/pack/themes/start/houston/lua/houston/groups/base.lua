local M = {}

---@param c ColorScheme
---@param opts houston.Config
function M.get(c, opts)
  return {
    -- Editor
    Normal = { fg = c.fg, bg = opts.transparent and c.none or c.bg },
    NormalNC = { fg = c.fg, bg = opts.transparent and c.none or c.bg },
    NormalFloat = { fg = c.fg, bg = c.bg_float },
    FloatBorder = { fg = c.border, bg = c.bg_float },

    -- Cursor
    Cursor = { fg = c.bg, bg = c.fg },
    CursorLine = { bg = c.bg_highlight },
    CursorColumn = { bg = c.bg_highlight },
    LineNr = { fg = c.fg_gutter },
    CursorLineNr = { fg = c.cyan, bold = true },

    -- Selection
    Visual = { bg = c.bg_visual },
    VisualNOS = { bg = c.bg_visual },
    Search = { bg = c.bg_search, fg = c.fg },
    IncSearch = { bg = c.yellow, fg = c.bg },
    CurSearch = { bg = c.yellow, fg = c.bg },

    -- UI Elements
    Pmenu = { bg = c.bg_popup, fg = c.fg },
    PmenuSel = { bg = c.bg_search },
    PmenuSbar = { bg = c.bg_dark },
    PmenuThumb = { bg = c.fg_gutter },

    StatusLine = { fg = c.fg_dark, bg = c.bg_statusline },
    StatusLineNC = { fg = c.fg_gutter, bg = c.bg_statusline },
    WinSeparator = { fg = c.border },
    VertSplit = { fg = c.border },

    -- Folds
    Folded = { fg = c.comment, bg = c.bg_dark },
    FoldColumn = { fg = c.fg_gutter },

    -- Signs
    SignColumn = { fg = c.fg_gutter, bg = opts.transparent and c.none or c.bg },

    -- Syntax - Base
    Comment = { fg = c.comment, italic = opts.styles.comments.italic },
    Constant = { fg = c.yellow },
    String = { fg = c.yellow },
    Character = { fg = c.yellow },
    Number = { fg = c.yellow },
    Boolean = { fg = c.yellow },
    Float = { fg = c.yellow },

    Identifier = { fg = c.green },
    Function = { fg = c.cyan },

    Statement = { fg = c.blue },
    Conditional = { fg = c.blue },
    Repeat = { fg = c.blue },
    Label = { fg = c.blue },
    Operator = { fg = c.fg },
    Keyword = { fg = c.blue },
    Exception = { fg = c.blue },

    PreProc = { fg = c.purple },
    Include = { fg = c.purple },
    Define = { fg = c.purple },
    Macro = { fg = c.purple },
    PreCondit = { fg = c.purple },

    Type = { fg = c.purple },
    StorageClass = { fg = c.blue },
    Structure = { fg = c.purple },
    Typedef = { fg = c.purple },

    Special = { fg = c.cyan },
    SpecialChar = { fg = c.cyan },
    Tag = { fg = c.blue },
    Delimiter = { fg = c.fg },
    SpecialComment = { fg = c.comment },
    Debug = { fg = c.orange },

    Underlined = { underline = true },
    Bold = { bold = true },
    Italic = { italic = true },

    Error = { fg = c.error },
    Todo = { bg = c.yellow, fg = c.bg },

    -- LSP
    LspReferenceText = { bg = c.bg_highlight },
    LspReferenceRead = { bg = c.bg_highlight },
    LspReferenceWrite = { bg = c.bg_highlight },

    -- Diagnostics
    DiagnosticError = { fg = c.error },
    DiagnosticWarn = { fg = c.warning },
    DiagnosticInfo = { fg = c.info },
    DiagnosticHint = { fg = c.hint },
    DiagnosticVirtualTextError = { fg = c.error, bg = c.bg_dark },
    DiagnosticVirtualTextWarn = { fg = c.warning, bg = c.bg_dark },
    DiagnosticVirtualTextInfo = { fg = c.info, bg = c.bg_dark },
    DiagnosticVirtualTextHint = { fg = c.hint, bg = c.bg_dark },
    DiagnosticUnderlineError = { undercurl = true, sp = c.error },
    DiagnosticUnderlineWarn = { undercurl = true, sp = c.warning },
    DiagnosticUnderlineInfo = { undercurl = true, sp = c.info },
    DiagnosticUnderlineHint = { undercurl = true, sp = c.hint },

    -- Diff
    DiffAdd = { bg = c.diff.add },
    DiffChange = { bg = c.diff.change },
    DiffDelete = { bg = c.diff.delete },
    DiffText = { bg = c.diff.text },
    diffAdded = { fg = c.git.add },
    diffRemoved = { fg = c.git.delete },
    diffChanged = { fg = c.git.change },

    -- Git
    GitSignsAdd = { fg = c.git.add },
    GitSignsChange = { fg = c.git.change },
    GitSignsDelete = { fg = c.git.delete },

    -- NonText
    NonText = { fg = c.fg_gutter },
    SpecialKey = { fg = c.fg_gutter },
    Whitespace = { fg = c.fg_gutter },
    EndOfBuffer = { fg = c.bg },

    -- Messages
    ErrorMsg = { fg = c.error },
    WarningMsg = { fg = c.warning },
    MoreMsg = { fg = c.cyan },
    Question = { fg = c.cyan },
    Title = { fg = c.blue, bold = true },

    -- Spelling
    SpellBad = { undercurl = true, sp = c.error },
    SpellCap = { undercurl = true, sp = c.warning },
    SpellLocal = { undercurl = true, sp = c.info },
    SpellRare = { undercurl = true, sp = c.hint },

    -- Misc
    Directory = { fg = c.cyan },
    MatchParen = { fg = c.yellow, bold = true },
    ModeMsg = { fg = c.fg_dark },
    MsgArea = { fg = c.fg_dark },
    QuickFixLine = { bg = c.bg_visual, bold = true },
    Substitute = { bg = c.red, fg = c.bg },
    WildMenu = { bg = c.bg_visual },

    -- Help
    helpCommand = { fg = c.yellow },
    helpExample = { fg = c.comment },

    -- HTML
    htmlH1 = { fg = c.green, bold = true },
    htmlH2 = { fg = c.cyan, bold = true },
    htmlH3 = { fg = c.blue, bold = true },
  }
end

return M
