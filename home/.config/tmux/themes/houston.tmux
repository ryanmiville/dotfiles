# Houston palette overrides for catppuccin-tmux
# Loaded after TPM so these win.

set -g status-style "fg=#EEF0F9,bg=#17191E"
set -g message-style "fg=#EEF0F9,bg=#23262D"
set -g message-command-style "fg=#54B9FF,bg=#23262D"
set -g mode-style "fg=#EEF0F9,bg=#2B7ECA"
set -g clock-mode-colour "#54B9FF"

set -g pane-border-style "fg=#545864"
set -g pane-active-border-style "fg=#ACAFFF"

set -g status-left-style "fg=#00DAEE,bg=#17191E"
set -g status-right-style "fg=#EEF0F9,bg=#17191E"

setw -g window-status-style "fg=#17191E,bg=#EEF0F9"
setw -g window-status-current-style "fg=#ACAFFF,bg=#343841"
setw -g window-status-activity-style "fg=#FF8551,bg=#EEF0F9"
setw -g window-status-bell-style "fg=#DC3657,bg=#EEF0F9"
