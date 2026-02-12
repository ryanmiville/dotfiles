local M = {}

---@param c ColorScheme
---@param opts houston.Config
function M.get(c, opts)
  return {
    -- Comments
    ["@comment"] = { link = "Comment" },
    ["@comment.documentation"] = { link = "Comment" },
    ["@comment.error"] = { fg = c.error },
    ["@comment.warning"] = { fg = c.warning },
    ["@comment.todo"] = { fg = c.todo },
    ["@comment.note"] = { fg = c.hint },

    -- Constants
    ["@constant"] = { link = "Constant" },
    ["@constant.builtin"] = { fg = c.yellow },
    ["@constant.macro"] = { link = "Define" },

    -- Strings
    ["@string"] = { link = "String" },
    ["@string.documentation"] = { link = "String" },
    ["@string.regex"] = { fg = c.yellow },
    ["@string.escape"] = { fg = c.cyan },
    ["@string.special"] = { fg = c.cyan },

    -- Characters
    ["@character"] = { link = "Character" },
    ["@character.special"] = { fg = c.cyan },

    -- Numbers
    ["@number"] = { link = "Number" },
    ["@number.float"] = { link = "Float" },
    ["@float"] = { link = "Float" },

    -- Booleans
    ["@boolean"] = { link = "Boolean" },

    -- Identifiers
    ["@variable"] = { fg = c.green },
    ["@variable.builtin"] = { fg = c.magenta },
    ["@variable.parameter"] = { fg = c.yellow },
    ["@variable.member"] = { fg = c.green },

    -- Properties
    ["@property"] = { fg = c.green },
    ["@field"] = { fg = c.green },

    -- Modules/Namespaces
    ["@module"] = { fg = c.purple },
    ["@namespace"] = { fg = c.purple },

    -- Functions
    ["@function"] = { link = "Function" },
    ["@function.builtin"] = { fg = c.cyan },
    ["@function.call"] = { link = "Function" },
    ["@function.macro"] = { link = "Macro" },
    ["@function.method"] = { link = "Function" },
    ["@function.method.call"] = { link = "Function" },
    ["@method"] = { link = "Function" },
    ["@method.call"] = { link = "Function" },

    -- Constructors
    ["@constructor"] = { fg = c.purple },

    -- Keywords
    ["@keyword"] = { fg = c.blue },
    ["@keyword.coroutine"] = { fg = c.blue },
    ["@keyword.function"] = { fg = c.blue },
    ["@keyword.operator"] = { fg = c.blue },
    ["@keyword.import"] = { fg = c.blue },
    ["@keyword.storage"] = { fg = c.blue },
    ["@keyword.repeat"] = { fg = c.blue },
    ["@keyword.return"] = { fg = c.blue },
    ["@keyword.debug"] = { fg = c.blue },
    ["@keyword.exception"] = { fg = c.blue },
    ["@keyword.conditional"] = { fg = c.blue },
    ["@keyword.conditional.ternary"] = { fg = c.blue },
    ["@keyword.directive"] = { fg = c.purple },
    ["@keyword.directive.define"] = { fg = c.purple },

    -- Types
    ["@type"] = { link = "Type" },
    ["@type.builtin"] = { fg = c.purple },
    ["@type.definition"] = { link = "Type" },
    ["@type.qualifier"] = { fg = c.blue },

    -- Operators
    ["@operator"] = { fg = c.fg },

    -- Punctuation
    ["@punctuation.delimiter"] = { fg = c.fg },
    ["@punctuation.bracket"] = { fg = c.fg },
    ["@punctuation.special"] = { fg = c.cyan },

    -- Tags (HTML, XML, JSX, etc.)
    ["@tag"] = { fg = c.blue },
    ["@tag.attribute"] = { fg = c.green },
    ["@tag.delimiter"] = { fg = c.fg },
    ["@tag.builtin"] = { fg = c.blue },

    -- Text
    ["@text"] = { fg = c.fg },
    ["@text.strong"] = { bold = true },
    ["@text.emphasis"] = { italic = true },
    ["@text.underline"] = { underline = true },
    ["@text.strike"] = { strikethrough = true },
    ["@text.literal"] = { fg = c.yellow },
    ["@text.uri"] = { fg = c.cyan, underline = true },
    ["@text.math"] = { fg = c.blue },
    ["@text.environment"] = { fg = c.purple },
    ["@text.environment.name"] = { fg = c.purple },
    ["@text.reference"] = { fg = c.cyan },

    -- Titles and headings
    ["@text.title"] = { fg = c.green, bold = true },
    ["@text.todo"] = { fg = c.todo },
    ["@text.note"] = { fg = c.hint },
    ["@text.warning"] = { fg = c.warning },
    ["@text.danger"] = { fg = c.error },

    -- Diff
    ["@diff.plus"] = { link = "DiffAdd" },
    ["@diff.minus"] = { link = "DiffDelete" },
    ["@diff.delta"] = { link = "DiffChange" },

    -- Labels
    ["@label"] = { fg = c.blue },

    -- Attributes
    ["@attribute"] = { fg = c.purple },
    ["@attribute.builtin"] = { fg = c.purple },

    -- Annotations
    ["@annotation"] = { fg = c.purple },

    -- Conceal
    ["@conceal"] = { fg = c.fg_gutter },

    -- Define (for C preprocessor)
    ["@define"] = { fg = c.purple },
    ["@macro"] = { fg = c.purple },

    -- Preprocessor
    ["@preproc"] = { fg = c.purple },
    ["@include"] = { fg = c.purple },
  }
end

return M
