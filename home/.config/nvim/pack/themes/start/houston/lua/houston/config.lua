local M = {}

---@class houston.Config
---@field on_colors fun(colors: ColorScheme)
---@field on_highlights fun(highlights: table, colors: ColorScheme)
M.defaults = {
  transparent = false,
  terminal_colors = true,
  styles = {
    comments = { italic = true },
    keywords = {},
    functions = {},
    variables = {},
    sidebars = "dark",
    floats = "dark",
  },
  on_colors = function(colors) end,
  on_highlights = function(highlights, colors) end,
  ---@type table<string, boolean|{enabled:boolean}>
  plugins = {
    auto = true,
  },
}

---@type houston.Config
M.options = nil

---@param options? houston.Config
function M.setup(options)
  M.options = vim.tbl_deep_extend("force", {}, M.defaults, options or {})
end

---@param opts? houston.Config
function M.extend(opts)
  return opts and vim.tbl_deep_extend("force", {}, M.options, opts) or M.options
end

setmetatable(M, {
  __index = function(_, k)
    if k == "options" then
      return M.defaults
    end
  end,
})

return M
