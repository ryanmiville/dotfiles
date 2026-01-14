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

# Homebrew setup
if ('/opt/homebrew' | path type) == 'dir' {
  $env.HOMEBREW_PREFIX = '/opt/homebrew'
  $env.HOMEBREW_CELLAR = '/opt/homebrew/Cellar'
  $env.HOMEBREW_REPOSITORY = '/opt/homebrew'
  $env.PATH = $env.PATH? | prepend [
    '/opt/homebrew/bin'
    '/opt/homebrew/sbin'
  ]
  $env.MANPATH = $env.MANPATH? | prepend '/opt/homebrew/share/man'
  $env.INFOPATH = $env.INFOPATH? | prepend '/opt/homebrew/share/info'
}

$env.SSL_CERT_FILE = "/Library/Application Support/Netskope/Certs/netskope-cert-bundle.pem"
$env.AWS_CA_BUNDLE = "/Library/Application Support/Netskope/Certs/netskope-cert-bundle.pem"
$env.REQUESTS_CA_BUNDLE = "/Library/Application Support/Netskope/Certs/netskope-cert-bundle.pem"
$env.CURL_CA_BUNDLE = "/Library/Application Support/Netskope/Certs/netskope-cert-bundle.pem"
$env.NODE_EXTRA_CA_CERTS = "/Library/Application Support/Netskope/Certs/netskope-cert-bundle.pem"

$env.PROMPT_INDICATOR_VI_NORMAL = $"(ansi { fg: 'light_green' attr: b }) ❮(ansi reset) "
$env.PROMPT_INDICATOR_VI_INSERT = $"(ansi { fg: 'light_green' attr: b }) ❯(ansi reset) "
$env.PROMPT_MULTILINE_INDICATOR = ""

# Load from-env utility
source ($nu.config-path | path dirname | path join "from-env.nu")

# Load autoload scripts
source ($nu.data-dir | path join "vendor/autoload/starship.nu")
source ($nu.data-dir | path join "vendor/autoload/zoxide.nu")
source ($nu.config-path | path dirname | path join "custom.nu")

# Load secrets from ~/.secrets file if it exists
if ($"($env.HOME)/.secrets" | path exists) {
  open $"($env.HOME)/.secrets" | from env | load-env
}

# Environment Variables
$env.XDG_CONFIG_HOME = $"($env.HOME)/.config"

$env.GOPATH = $"($env.HOME)/go"
$env.GOPRIVATE = "github.com/GetTerminus"
$env.EDITOR = "nvim"
$env.PNPM_HOME = $"($env.HOME)/Library/pnpm"
$env.BUN_INSTALL = $"($env.HOME)/.bun"
$env.AWS_ASSUME_ROLE_TTL = "3600"
$env.AWS_SESSION_TOKEN_TTL = "3600"
$env.NVM_DIR = $"($env.HOME)/.nvm"
$env.BREWFILE_PATH = $"($env.HOME)/.config/brew/Brewfile"
$env.H3_CLI_HOME = $"($env.HOME)/dev/h3-cli"

# PostgreSQL
$env.PG_ROOT = "/opt/homebrew/opt/postgresql@16"
$env.LDFLAGS = $"-L($env.PG_ROOT)/lib"
$env.CPPFLAGS = $"-I($env.PG_ROOT)/include"
$env.PKG_CONFIG_PATH = $"($env.PG_ROOT)/lib/pkgconfig"

# PATH modifications
$env.PATH = ($env.PATH | split row (char esep) | prepend [
  $"($env.GOPATH)/bin"
  $"($env.HOME)/dev/rymi-utils/scripts"
  "/usr/local/sbin"
  $"($env.HOME)/.local/bin"
  $env.PNPM_HOME
  $"($env.BUN_INSTALL)/bin"
  $"($env.HOME)/.opencode/bin"
  "/opt/homebrew/opt/postgresql@16/bin"
  $"($env.H3_CLI_HOME)/bin"
] | uniq)

$env.OPENCODE_EXPERIMENTAL_PLAN_MODE = "1"
# Note: Custom commands and aliases are defined in the autoload/custom.nu file
# and loaded automatically at startup


mkdir ($nu.data-dir | path join "vendor/autoload")
starship init nu | save -f ($nu.data-dir | path join "vendor/autoload/starship.nu")
zoxide init --cmd cd nushell | save -f ($nu.data-dir | path join "vendor/autoload/zoxide.nu")
