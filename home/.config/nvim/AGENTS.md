# NEOVIM CONFIG

Modular Lua config using lazy.nvim. Personal namespace `rymi/`.

## STRUCTURE

```
nvim/
├── init.lua           # Entry: require("rymi")
├── lazy-lock.json     # Plugin lock (auto-managed)
├── lsp/               # LSP server configs
│   └── lua_ls.lua
└── lua/
    ├── rymi/          # Personal modules
    │   ├── init.lua   # Load order: options → lazy → keymaps → utils
    │   ├── options.lua
    │   ├── keymaps.lua
    │   ├── lazy.lua   # Bootstrap lazy.nvim
    │   └── *.lua      # Utilities (highlight_yank, toggle_diagnostics, etc.)
    └── plugins/       # One file per plugin (32 plugins)
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add plugin | `lua/plugins/<name>.lua` - return lazy.nvim spec table |
| Change keymap | `lua/rymi/keymaps.lua` |
| Vim options | `lua/rymi/options.lua` |
| LSP config | `lua/plugins/lsp.lua` + `lsp/<server>.lua` |
| Completion | `lua/plugins/blink.lua` |
| Formatting | `lua/plugins/conform.lua` |

## KEY PLUGINS

| Plugin | Purpose | File |
|--------|---------|------|
| blink | Completion | `plugins/blink.lua` |
| conform | Formatting | `plugins/conform.lua` |
| gitsigns | Git hunks | `plugins/gitsigns.lua` |
| snacks | Pickers/UI | `plugins/snacks.lua` |
| lsp | Language servers | `plugins/lsp.lua` |
| treesitter | Syntax | `plugins/treesitter.lua` |
| harpoon | File marks | `plugins/harpoon.lua` |
| oil | File explorer | `plugins/oil.lua` |

## CONVENTIONS

- Plugin files return `{ { "author/plugin", ... } }` table
- Keymaps use `<leader>` (space) prefix
- All navigation centers cursor (`zz` suffix)
- LSP keybinds set in `keymaps.lua:map_lsp_keybinds()`

## KEY BINDINGS

| Key | Action |
|-----|--------|
| `<leader>w` | Save |
| `<leader>q` | Quit |
| `<leader>e` | Oil file explorer |
| `<leader>1-5` | Harpoon files |
| `<leader>F` | Format buffer |
| `<leader>r` | LSP rename |
| `<leader>ca` | Code action |
| `gd` | Go to definition |
| `K` | Hover docs |

## ANTI-PATTERNS

- **Never** edit `lazy-lock.json` manually
- **Never** put plugin config in `init.lua` - use `plugins/` dir
- **Never** define keymaps outside `keymaps.lua` (except plugin-specific in their file)
