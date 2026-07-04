;; Helix Steel plugin entrypoint.
;; Exported functions become `:` commands.

(require "helix/editor.scm")
(require (prefix-in helix. "helix/commands.scm"))
(require (prefix-in helix.static. "helix/static.scm"))

(provide open-helix-scm open-init-scm)

;;@doc
;; Open ~/.config/helix/helix.scm
(define (open-helix-scm)
  (helix.open (helix.static.get-helix-scm-path)))

;;@doc
;; Open ~/.config/helix/init.scm
(define (open-init-scm)
  (helix.open (helix.static.get-init-scm-path)))
