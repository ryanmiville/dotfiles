local M = {}

-- Map plugin names to their integration module names
M.plugins = {
  ["snacks.nvim"] = "snacks",
  ["nvim-tree.lua"] = "nvim-tree",
  ["which-key.nvim"] = "which-key",
  ["gitsigns.nvim"] = "gitsigns",
  ["diffview.nvim"] = "diffview",
  ["blink.cmp"] = "blink",
  ["fidget.nvim"] = "fidget",
  ["todo-comments.nvim"] = "todo-comments",
  ["render-markdown.nvim"] = "render-markdown",
  ["hop.nvim"] = "hop",
  ["nvim-spectre"] = "spectre",
  ["nvim-ufo"] = "ufo",
  ["oil.nvim"] = "oil",
  ["tiny-inline-diagnostic.nvim"] = "tiny-inline-diagnostic",
}

---@param name string
function M.get_group(name)
  return require("houston.groups." .. name)
end

---@param colors ColorScheme
---@param opts houston.Config
function M.setup(colors, opts)
  local groups = {
    base = true,
    treesitter = true,
  }

  -- Auto-detect installed plugins via lazy.nvim
  if opts.plugins.auto and package.loaded.lazy then
    local ok, lazy_config = pcall(require, "lazy.core.config")
    if ok and lazy_config.plugins then
      for plugin, group in pairs(M.plugins) do
        if lazy_config.plugins[plugin] then
          groups[group] = true
        end
      end
    end
  end

  -- Apply manual overrides from opts.plugins
  for group, enabled in pairs(opts.plugins) do
    if group ~= "auto" then
      if type(enabled) == "table" then
        enabled = enabled.enabled
      end
      groups[group] = enabled or nil
    end
  end

  local ret = {}
  for group in pairs(groups) do
    local ok, mod = pcall(M.get_group, group)
    if ok and mod.get then
      for k, v in pairs(mod.get(colors, opts)) do
        ret[k] = v
      end
    end
  end

  if opts.on_highlights then
    opts.on_highlights(ret, colors)
  end

  return ret
end

return M
