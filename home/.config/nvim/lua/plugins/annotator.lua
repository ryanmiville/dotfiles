--foo
return {
	enabled = false,
	"ryanmiville/fooannotator.nvim",
	keys = { "<leader>aa", "<leader>ax" },
	cmd = {
		"AnnotatorAdd",
		"AnnotatorSuggest",
		"AnnotatorMarkDelete",
		"AnnotatorLabel",
		"AnnotatorEdit",
		"AnnotatorDelete",
		"AnnotatorList",
		"AnnotatorExport",
		"AnnotatorClear",
	},
	opts = {},
}
