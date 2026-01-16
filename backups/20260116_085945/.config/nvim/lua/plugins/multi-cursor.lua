return {
	"jake-stewart/multicursor.nvim",
	branch = "1.0",
	config = function()
		local mc = require("multicursor-nvim")

		mc.setup()

		local set = vim.keymap.set

		-- Add or skip cursor above/below the main cursor.
		set({ "n", "x" }, "gk", function()
			mc.lineAddCursor(-1)
		end)
		set({ "n", "x" }, "gj", function()
			mc.lineAddCursor(1)
		end)
		-- Add or skip adding a new cursor by matching word/selection
		set({ "n", "x" }, "gn", function()
			mc.matchAddCursor(1)
		end)
		set({ "n", "x" }, "g>", function()
			mc.matchSkipCursor(1)
		end)
		set({ "n", "x" }, "gN", function()
			mc.matchAddCursor(-1)
		end)
		set({ "n", "x" }, "g<", function()
			mc.matchSkipCursor(-1)
		end)

		-- Add all matches in the document
		set({ "n", "x" }, "ga", mc.matchAllAddCursors)

		-- You can also add cursors with any motion you prefer: set("n", "<right>",
		-- function()
		--     mc.addCursor("w")
		-- end)
		-- set("n", "<leader><right>", function()
		--     mc.skipCursor("w")
		-- end)

		-- Rotate the main cursor.
		-- set({ "n", "x" }, "<left>", mc.nextCursor)
		-- set({ "n", "x" }, "<right>", mc.prevCursor)

		-- Delete the main cursor.
		-- set({ "n", "x" }, "<leader>x", mc.deleteCursor)

		-- Add and remove cursors with control + left click.
		set("n", "<c-leftmouse>", mc.handleMouse)

		-- Easy way to add and remove cursors using the main cursor.
		set({ "n", "x" }, "<c-q>", mc.toggleCursor)

		-- Clone every cursor and disable the originals.
		set({ "n", "x" }, "<leader><c-q>", mc.duplicateCursors)

		-- bring back cursors if you accidentally clear them
		set("n", "<leader>gv", mc.restoreCursors)

		-- Align cursor columns.
		-- set("n", "<leader>a", mc.alignCursors)

		-- Split visual selections by regex.
		set("v", "|", mc.splitCursors)

		-- Append/insert for each line of visual selections.
		set("v", "I", mc.insertVisual)
		set("v", "A", mc.appendVisual)

		-- match new cursors within visual selections by regex.
		set("v", "/", mc.matchCursors)

		-- Rotate visual selection contents.
		-- set("v", "<leader>t", function()
		-- 	mc.transposeCursors(1)
		-- end)
		-- set("v", "<leader>T", function()
		-- 	mc.transposeCursors(-1)
		-- end)

		-- Jumplist support
		-- set({ "v", "n" }, "<c-i>", mc.jumpForward)
		-- set({ "v", "n" }, "<c-o>", mc.jumpBackward)

		mc.addKeymapLayer(function(layerSet)

		    -- Select a different cursor as the main one.
		    layerSet({"n", "x"}, "<left>", mc.prevCursor)
		    layerSet({"n", "x"}, "<right>", mc.nextCursor)

		    -- Delete the main cursor.
		    layerSet({"n", "x"}, "<leader>x", mc.deleteCursor)

		    -- Enable and clear cursors using escape.
		    layerSet("n", "<esc>", function()
			if not mc.cursorsEnabled() then
			    mc.enableCursors()
			else
			    mc.clearCursors()
			end
		    end)
		end)

		-- Customize how cursors look.
		local hl = vim.api.nvim_set_hl
		hl(0, "MultiCursorCursor", { link = "Cursor" })
		hl(0, "MultiCursorVisual", { link = "Visual" })
		hl(0, "MultiCursorSign", { link = "SignColumn" })
		hl(0, "MultiCursorDisabledCursor", { link = "Visual" })
		hl(0, "MultiCursorDisabledVisual", { link = "Visual" })
		hl(0, "MultiCursorDisabledSign", { link = "SignColumn" })
	end,
}
