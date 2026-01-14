# config.nu
#
# Installed by:
# version = "0.101.0"
#
# This file is used to override default Nushell settings, define
# (or import) custom commands, or run any other startup tasks.
# See https://www.nushell.sh/book/configuration.html
#
# This file is loaded after env.nu and before login.nu
#
# You can open this file in your default editor using:
# config nu
#
# See `help config nu` for more options
#
# You can remove these comments if you want or leave
# them for future reference.
#

$env.config = {
  show_banner: false

  cursor_shape: {
    vi_insert: line
    vi_normal: block
    emacs: line
  }

  edit_mode: 'vi'

  keybindings: [
    {
      name: accept_completion_or_move_forward
      modifier: control
      keycode: char_f
      mode: [emacs, vi_insert, vi_normal]
      event: [
        { send: historyhintcomplete }
        { edit: moveright }
      ]
    }
    {
       name: delete_one_word_backward
       modifier: alt
       keycode: backspace
       mode: [emacs, vi_normal, vi_insert]
       event: {edit: backspaceword}
    }
    {
        name: move_left
        modifier: control
        keycode: char_b
        mode: [emacs, vi_insert, vi_normal]
        event: {
            until: [
                { send: menuleft }
                { send: left }
            ]
        }
    }
    {
        name: delete_line
        modifier: control
        keycode: char_u
        mode: [emacs, vi_insert, vi_normal]
        event: { edit: cutfromlinestart }
    }
  ]
}

# Load autoload scripts
source ($nu.data-dir | path join "vendor/autoload/starship.nu")
source ($nu.data-dir | path join "vendor/autoload/zoxide.nu")
source ($nu.config-path | path dirname | path join "custom.nu")

# Note: Custom commands and aliases are defined in the autoload/custom.nu file
# and loaded automatically at startup


mkdir ($nu.data-dir | path join "vendor/autoload")
starship init nu | save -f ($nu.data-dir | path join "vendor/autoload/starship.nu")
zoxide init --cmd cd nushell | save -f ($nu.data-dir | path join "vendor/autoload/zoxide.nu")
