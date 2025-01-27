# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

source ~/.secrets

export GOPATH=/Users/ryan.miville/go
export PATH=$PATH:$GOPATH/bin
export GOPRIVATE=github.com/GetTerminus

# export JAVA_HOME="/Users/ryan.miville/Library/Caches/Coursier/arc/https/github.com/adoptium/temurin8-binaries/releases/download/jdk8u432-b06/OpenJDK8U-jdk_x64_mac_hotspot_8u432b06.tar.gz/jdk8u432-b06/Contents/Home"
export JAVA_HOME="/Users/ryan.miville/Library/Caches/Coursier/arc/https/github.com/adoptium/temurin17-binaries/releases/download/jdk-17%252B35/OpenJDK17-jdk_x64_mac_hotspot_17_35.tar.gz/jdk-17+35/Contents/Home"
export JAVA_HOMES="/Users/ryan.miville/Library/Caches/Coursier/arc/https/github.com/adoptium"
export PATH="$PATH:/Users/ryan.miville/Library/Application Support/Coursier/bin"

export PATH="/usr/local/sbin:$PATH"

export EDITOR="hx"

### Added by Zinit's installer
if [[ ! -f $HOME/.local/share/zinit/zinit.git/zinit.zsh ]]; then
    print -P "%F{33} %F{220}Installing %F{33}ZDHARMA-CONTINUUM%F{220} Initiative Plugin Manager (%F{33}zdharma-continuum/zinit%F{220})…%f"
    command mkdir -p "$HOME/.local/share/zinit" && command chmod g-rwX "$HOME/.local/share/zinit"
    command git clone https://github.com/zdharma-continuum/zinit "$HOME/.local/share/zinit/zinit.git" && \
        print -P "%F{33} %F{34}Installation successful.%f%b" || \
        print -P "%F{160} The clone has failed.%f%b"
fi

source "$HOME/.local/share/zinit/zinit.git/zinit.zsh"
autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit

# Load a few important annexes, without Turbo
# (this is currently required for annexes)
zinit light-mode for \
    zdharma-continuum/zinit-annex-as-monitor \
    zdharma-continuum/zinit-annex-bin-gem-node \
    zdharma-continuum/zinit-annex-patch-dl \
    zdharma-continuum/zinit-annex-rust

### End of Zinit's installer chunk

# Add in Powerlevel10k
zinit ice depth=1; zinit light romkatv/powerlevel10k

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# Add zsh plugins
zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions
zinit light zsh-users/zsh-autosuggestions
zinit light Aloxaf/fzf-tab
zinit light jeffreytse/zsh-vi-mode

# For postponing loading `fzf`
# needed to get ctrl-r with zsh-vi-mode
zinit ice lucid wait
zinit snippet OMZP::fzf

# Load completions
autoload -U compinit && compinit

# Open in EDITOR
# autoload edit-command-line
# zle -N edit-command-line
# bindkey '^Xe' edit-command-line

zinit cdreplay -q

# Keybindings
# bindkey -e
# bindkey '^p' history-search-backward
# bindkey '^n' history-search-forward

# History
HISTSIZE=5000
HISTFILE=~/.zsh_history
SAVEHIST=$HISTSIZE
HISTDUP=erase
setopt appendhistory
setopt sharehistory
setopt hist_ignore_space
setopt hist_ignore_all_dups
setopt hist_save_no_dups
setopt hist_ignore_dups

# Completion styling
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

# Shell integrations
source <(fzf --zsh)
eval "$(zoxide init --cmd cd zsh)"

# eval "$(/opt/homebrew/bin/brew shellenv)"

alias zshrc="$EDITOR ~/.zshrc && source ~/.zshrc"
alias zsource="source ~/.zshrc"
alias tf="terraform"
alias vim="nvim"
alias nvc="cd ~/.config/nvim && nvim && cd -"

alias gs="git status"
alias ammend="git commit --amend --no-edit"
alias Force="git add -A && git commit --amend --no-edit && git push --force-with-lease"
alias gu='cd $(git rev-parse --show-toplevel)'
alias fz='cd $(fd -t d . | fzf)'
alias gcb='git checkout -b'
alias gp='git pull'
alias gpm='git pull'
alias gpf='git push --force-with-lease'
alias gsa='git stash apply'
alias gbr="git branch | grep -v 'master' | grep -v 'main' | xargs -I % git branch -D %"
alias lg="lazygit"
alias gaa="git add -A"
alias gc="git commit -m"
alias lastsha="git rev-parse HEAD | tr -d '\n' | pbcopy"
alias gpv="gh pr view --web"
alias grv="gh repo view --web"

gcm() {
  if git show-ref --verify --quiet "refs/heads/main"; then
    git checkout main
  else
    git checkout master
  fi
}

# replacement tools
alias cat="bat"
alias ls="eza"
alias pip="pip3"
alias pn="pnpm"
alias docker="podman"
export DOCKER_HOST='unix:///var/folders/vr/prvjkl395tl6zhwr1ztksghr0000gp/T/podman/podman-machine-default-api.sock'

mkfiledir() {
    mkdir -p "$(dirname "$1")" && /usr/bin/touch "$1"
}

alias touch=mkfiledir

# pnpm
export PNPM_HOME="/Users/ryan.miville/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# deno
export DENO_INSTALL="/Users/ryan.miville/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
# deno end

# bun completions
[ -s "/Users/ryan.miville/.bun/_bun" ] && source "/Users/ryan.miville/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

#1password shell stuff
export AWS_ASSUME_ROLE_TTL=3600
export AWS_SESSION_TOKEN_TTL=3600

# source /Users/ryan.miville/.config/op/plugins.sh

mfa() {
 local resp
 resp=$(op item get ebrv6sjr6okpwidowsh5u6bz3i --otp)
 echo "$resp"
}

sts() {
    local token=$(mfa)

    local stsResponse
    stsResponse=$(aws --profile prod sts get-session-token --serial-number "arn:aws:iam::911070201873:mfa/phone" --token-code "$token" --duration-seconds 10800 --output json)

    local accessKey
    accessKey=$(echo $stsResponse | jq '.Credentials.AccessKeyId' | tr -d '"')

    local secretKey
    secretKey=$(echo $stsResponse | jq '.Credentials.SecretAccessKey' | tr -d '"')

    local sessionToken
    sessionToken=$(echo $stsResponse | jq '.Credentials.SessionToken' | tr -d '"')

    aws configure set aws_access_key_id "$accessKey" --profile sts
    aws configure set aws_secret_access_key "$secretKey" --profile sts
    aws configure set aws_session_token "$sessionToken" --profile sts
    aws configure set region us-east-1 --profile sts

}

function y() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	yazi "$@" --cwd-file="$tmp"
	if cwd="$(command cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
		builtin cd -- "$cwd"
	fi
	rm -f -- "$tmp"
}

function sbt_version() {
	local version="$(gum choose "8" "17")"
	if [ "$version" = "8" ]; then
		JAVA_HOME="/Users/ryan.miville/Library/Caches/Coursier/arc/https/github.com/adoptium/temurin8-binaries/releases/download/jdk8u432-b06/OpenJDK8U-jdk_x64_mac_hotspot_8u432b06.tar.gz/jdk8u432-b06/Contents/Home" sbt
	else
		sbt
	fi
}

alias sbt=sbt_version

. /usr/local/opt/asdf/libexec/asdf.sh
