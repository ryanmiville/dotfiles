return {
    "atiladefreitas/bloocky",
    keys = { "<leader>tb" },
    cmd = { "Bloocky", "BloockyToggle", "BloockyAdd" },
    config = function()
        require("bloocky").setup({
            -- your custom config here (optional)
        })
    end,
}
