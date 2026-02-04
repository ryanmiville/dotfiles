# env.nu
#
# Installed by:
# version = "0.101.0"
#
# Previously, environment variables were typically configured in `env.nu`.
# In general, most configuration can and should be performed in `config.nu`
# or one of the autoload directories.
#
# This file is generated for backwards compatibility for now.
# It is loaded before config.nu and login.nu
#
# See https://www.nushell.sh/book/configuration.html
#
# Also see `help config env` for more options.
#
# You can remove these comments if you want or leave
# them for future reference.

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

$env.PROMPT_INDICATOR_VI_NORMAL = ""
$env.PROMPT_INDICATOR_VI_INSERT = ""
$env.PROMPT_MULTILINE_INDICATOR = ""

# $env.PROMPT_INDICATOR_VI_NORMAL = $"(ansi { fg: 'light_green' attr: b }) ❮(ansi reset) "
# $env.PROMPT_INDICATOR_VI_INSERT = $"(ansi { fg: 'light_green' attr: b }) ❯(ansi reset) "
# $env.PROMPT_MULTILINE_INDICATOR = ""

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
$env.PATH ++= [
  $"($env.GOPATH)/bin",
  $"($env.HOME)/dev/rymi-utils/scripts",
  "/usr/local/sbin",
  $"($env.HOME)/.local/bin",
  $env.PNPM_HOME,
  $"($env.BUN_INSTALL)/bin",
  $"($env.HOME)/.opencode/bin",
  "/opt/homebrew/opt/postgresql@16/bin",
  $"($env.H3_CLI_HOME)/bin",
]

$env.OPENCODE_EXPERIMENTAL_PLAN_MODE = "1"
$env.OPENCODE_EXPERIMENTAL_LSP_TOOL = "1"

if ($"($env.HOME)/.secrets" | path exists) {
  ^cat $"($env.HOME)/.secrets" 
  | lines 
  | parse "{key}={value}" 
  | transpose -r 
  | into record 
  | load-env
}

if ("/opt/homebrew/opt/nvm/nvm.sh" |  path exists) {
  ^bash -c '. "/opt/homebrew/opt/nvm/nvm.sh"; env'
  | lines
  | parse "{name}={value}"
  | where name in ["NVM_DIR", "PATH", "NVM_BIN", "NVM_INC", "NVM_CD_FLAGS"]
  | transpose -r
  | into record
  | load-env
}

