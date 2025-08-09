return {
    "scalameta/nvim-metals",
    dependencies = {
        "nvim-lua/plenary.nvim",
    },
    ft = { "scala", "sbt", "java" },
    opts = function()
        local metals_config = require("metals").bare_config()
        metals_config.on_attach = function(client, bufnr)
            -- your on_attach function
        end

        return metals_config
    end,
    config = function(self, metals_config)
        metals_config.tvp = {
            icons = {
                enabled = true,
            },
        }

        metals_config.init_options = {
            statusBarProvider = "off",
        }

        local nvim_metals_group = vim.api.nvim_create_augroup("nvim-metals", { clear = true })
        vim.api.nvim_create_autocmd("FileType", {
            pattern = self.ft,
            callback = function()
                require("metals").initialize_or_attach(metals_config)
            end,
            group = nvim_metals_group,
        })

        vim.keymap.set("n", "<leader>M", require("metals").commands, { desc = "Find Metals Commands" })
        --map("v", "K", require("metals").type_of_range)
        vim.keymap.set("v", "K", require("metals").type_of_range)
    end,
}
