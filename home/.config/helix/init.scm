;; Helix Steel plugin startup.

(require "helix/configuration.scm")
(require (only-in "helix/ext.scm" evalp eval-buffer))

;; Scheme/Steel LSP for plugin hacking.
(define-lsp "steel-language-server" (command "steel-language-server") (args '()))
(define-language "scheme"
                 (language-servers '("steel-language-server")))
