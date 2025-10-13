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

mkdir ($nu.data-dir | path join "vendor/autoload")
starship init nu | save -f ($nu.data-dir | path join "vendor/autoload/starship.nu")
zoxide init --cmd cd nushell | save -f ($nu.data-dir | path join "vendor/autoload/zoxide.nu")

$env.PROMPT_INDICATOR_VI_NORMAL = $"(ansi { fg: '#FF6AC1' attr: b }) ❮(ansi reset) "
$env.PROMPT_INDICATOR_VI_INSERT = $"(ansi { fg: '#FF6AC1' attr: b }) ❯(ansi reset) "
$env.PROMPT_MULTILINE_INDICATOR = ""

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
] | uniq)

# Aliases
# alias zsource = source ~/.zshrc
alias tf = terraform
alias vim = nvim
# alias nvc = cd ~/.config/nvim; nvim; cd -

# Git aliases
alias gs = git status
alias ammend = git commit --amend --no-edit
def Force [] {
  git add -A
  git commit --amend --no-edit
  git push --force-with-lease
}
alias gcb = git checkout -b
alias gp = git pull
alias gpm = git pull
alias gpf = git push --force-with-lease
alias gsa = git stash apply
alias lg = lazygit
alias gaa = git add -A
alias gc = git commit -m
alias gpv = gh pr view --web
alias grv = gh repo view --web

# Replacement tools
# alias ls = eza
alias pn = pnpm

# Custom functions
def gcm [] {
  if (git show-ref --verify --quiet "refs/heads/main" | complete | get exit_code) == 0 {
    git checkout main
  } else {
    git checkout master
  }
}

def gu [] {
  cd (^git rev-parse --show-toplevel)
}

def fz [] {
  cd (^fd -t d . | ^fzf)
}

def gbr [] {
  ^git branch | lines | where {|it| $it !~ 'master' and $it !~ 'main'} | each {|br| ^git branch -D $br}
}

def lastsha [] {
  ^git rev-parse HEAD | tr -d '\n' | ^pbcopy
}

# def mkfiledir [path: string] {
#   mkdir ($path | path dirname)
#   touch $path
# }

def y [...args] {
  let tmp = (mktemp -t "yazi-cwd.XXXXXX")
  yazi ...$args --cwd-file=$tmp
  let cwd = (open $tmp | str trim)
  if $cwd != "" and $cwd != $env.PWD {
    cd $cwd
  }
  rm -f $tmp
}

def mybrew [...args] {
  /opt/homebrew/bin/brew ...$args
  /opt/homebrew/bin/brew bundle dump --force --file=$env.BREWFILE_PATH
}

alias brew = mybrew
