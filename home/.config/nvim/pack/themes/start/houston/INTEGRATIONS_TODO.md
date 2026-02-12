# Plugin Integrations TODO

List of plugins with themeable UI elements found in the user's nvim config.

## Core UI (High Priority)

- [ ] **snacks.nvim** - Pickers, dashboard, notifications, indent guides, statuscolumn, git
  - Used: picker, dashboard, notifier, indent, statuscolumn, toggle, input, quickfile, rename
  - Files: `lua/plugins/snacks.lua`
  - HL groups: SnacksPicker*, SnacksNotifier*, SnacksIndent*, SnacksDashboard*

- [ ] **nvim-tree.lua** - File explorer
  - Used: file tree with git integration, floating windows
  - Files: `lua/plugins/tree.lua`
  - HL groups: NvimTree*, NvimTreeFolder*, NvimTreeGit*

- [ ] **which-key.nvim** - Key binding popup
  - Used: helix preset
  - Files: `lua/plugins/which-key.lua`
  - HL groups: WhichKey*, WhichKeyGroup, WhichKeyDesc, WhichKeyValue

- [ ] **lualine.nvim** - Status line
  - Used: currently using catppuccin theme, needs Houston theme
  - Files: `lua/plugins/lualine.lua`
  - HL groups: lualine_a_*, lualine_b_*, lualine_c_*

## Git & Diff

- [ ] **gitsigns.nvim** - Git signs in gutter
  - Used: hunk navigation, blame, preview
  - Files: `lua/plugins/gitsigns.lua`
  - HL groups: GitSignsAdd, GitSignsChange, GitSignsDelete, GitSigns*

- [ ] **diffview.nvim** - Git diff interface
  - Used: DiffviewOpen, DiffviewFileHistory
  - Files: `lua/plugins/diffview.lua`
  - HL groups: Diffview*

- [ ] **codediff.nvim** - Diff viewer
  - Used: CodeDiff, CodeDiff history
  - Files: `lua/plugins/vscode-diff.lua`
  - HL groups: n/a (uses nui.nvim)

## LSP & Diagnostics

- [ ] **blink.cmp** - Autocompletion UI
  - Used: completion menu, documentation, ghost text, signature help
  - Files: `lua/plugins/blink.lua`
  - HL groups: BlinkCmp*, CmpItemMenu, CmpItemKind*

- [ ] **fidget.nvim** - LSP progress indicator
  - Used: notifications, progress display with dots
  - Files: `lua/plugins/fidget.lua`
  - HL groups: FidgetTitle, FidgetTask

- [ ] **tiny-inline-diagnostic.nvim** - Inline diagnostics
  - Used: powerline preset, multiline diagnostics
  - Files: `lua/plugins/tiny-inline-diagnostics.lua`
  - HL groups: TinyInlineDiagnostic*

## Navigation & Motion

- [ ] **hop.nvim** - Motion hints
  - Used: HopWord, HopPattern, HopLine
  - Files: `lua/plugins/hop.lua`
  - HL groups: HopNextKey, HopNextKey1, HopNextKey2, HopUnmatched

- [ ] **oil.nvim** - File manager
  - Used: floating file manager, confirmation dialogs
  - Files: `lua/plugins/oil.lua`
  - HL groups: Oil*, uses regular directory/file HL groups

- [ ] **nvim-ufo** - Folding
  - Used: fold peek, fold column
  - Files: `lua/plugins/folds.lua`
  - HL groups: Folded, FoldColumn

## Comments & Notes

- [ ] **todo-comments.nvim** - Todo/comment highlighting
  - Used: signs disabled, highlighting in comments
  - Files: `lua/plugins/todo.lua`
  - HL groups: TodoBgTODO, TodoFgTODO, TodoSignTODO, etc.

- [ ] **render-markdown.nvim** - Markdown rendering
  - Used: code blocks, headings
  - Files: `lua/plugins/render-markdown.lua`
  - HL groups: RenderMarkdownCode, RenderMarkdownH1-6

## Mini.nvim Suite

- [ ] **mini.ai** - Text objects
  - Files: `lua/plugins/mini.lua`
  - HL groups: MiniAiCursor, MiniAiRegion

- [ ] **mini.surround** - Surround operations
  - Files: `lua/plugins/mini.lua`
  - HL groups: MiniSurround

- [ ] **mini.sessions** - Session management
  - Files: `lua/plugins/mini.lua`
  - HL groups: n/a (UI minimal)

## Search & Replace

- [ ] **nvim-spectre** - Search and replace UI
  - Used: Spectre command, custom highlight groups (SpectreSearch, SpectreReplace)
  - Files: `lua/plugins/spectre.lua`
  - HL groups: SpectreSearch, SpectreReplace

## Visual Enhancements

- [ ] **nvim-highlight-colors** - Color preview
  - Used: hex, rgb, hsl, tailwind colors
  - Files: `lua/plugins/highlight-colors.lua`
  - HL groups: Generated dynamically

- [ ] **nvim-web-devicons** - File icons
  - Used: custom gleam icon, used by nvim-tree, oil, lualine
  - Files: `lua/plugins/web-devicons.lua`
  - HL groups: DevIcon*

- [ ] **dressing.nvim** - UI enhancements
  - Used: vim.ui.select, vim.ui.input
  - Files: `lua/plugins/dressing.lua`
  - HL groups: uses builtin HL groups

- [ ] **treesitter-context** - Context lines
  - Files: `lua/plugins/treesitter.lua`
  - HL groups: TreesitterContext, TreesitterContextLineNumber

## Notes

- LSP servers use standard LSP highlight groups (LspReference*, Diagnostic*, etc.) - these are already defined in base.lua
- The theme is loaded via `dir = vim.fn.stdpath("config") .. "/pack/themes/start/houston"` in `lua/plugins/theme.lua`
- User wants a standard dark theme only, no light mode or variants

## Reference Implementation

Check tokyonight-nvim/lua/tokyonight/groups/ for implementation patterns for most of these plugins.
