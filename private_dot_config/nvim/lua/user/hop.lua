local status_ok, hop = pcall(require, "hop")
if not status_ok then
  return
end

hop.setup()


local opts = { noremap = true, silent = true }
local keymap = vim.api.nvim_set_keymap

-- done in WhichKey --

keymap("", "<leader><leader>w", [[<cmd>lua require'hop'.hint_words()<CR>]], opts)
keymap("", "<leader><leader>f", [[<cmd>lua require'hop'.hint_char1()<CR>]], opts)
keymap("", "<leader><leader>s", [[<cmd>lua require'hop'.hint_char2()<CR>]], opts)
keymap("", "<leader><leader>/", [[<cmd>lua require'hop'.hint_patterns()<CR>]], opts)
keymap("", "<leader><leader>j", [[<cmd>lua require'hop'.hint_lines_skip_whitespace({ direction = require'hop.hint'.HintDirection.AFTER_CURSOR })<CR>]], opts)
keymap("", "<leader><leader>k", [[<cmd>lua require'hop'.hint_lines_skip_whitespace({ direction = require'hop.hint'.HintDirection.BEFORE_CURSOR })<CR>]], opts)

keymap('n', 'f', [[<cmd>lua require'hop'.hint_char1({ direction = require'hop.hint'.HintDirection.AFTER_CURSOR, current_line_only = true })<CR>]], opts)
keymap('n', 'F', [[<cmd>lua require'hop'.hint_char1({ direction = require'hop.hint'.HintDirection.BEFORE_CURSOR, current_line_only = true })<CR>]], opts)
keymap('o', 'f', [[<cmd>lua require'hop'.hint_char1({ direction = require'hop.hint'.HintDirection.AFTER_CURSOR, current_line_only = true, inclusive_jump = true })<CR>]], opts)
keymap('o', 'F', [[<cmd>lua require'hop'.hint_char1({ direction = require'hop.hint'.HintDirection.BEFORE_CURSOR, current_line_only = true, inclusive_jump = true })<CR>]], opts)
keymap('', 't', [[<cmd>lua require'hop'.hint_char1({ direction = require'hop.hint'.HintDirection.AFTER_CURSOR, current_line_only = true })<CR>]], opts)
keymap('', 'T', [[<cmd>lua require'hop'.hint_char1({ direction = require'hop.hint'.HintDirection.BEFORE_CURSOR, current_line_only = true })<CR>]], opts)

