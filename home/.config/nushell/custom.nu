# Custom commands and aliases

# Get MFA token from 1Password
def mfa [] {
  ^op item get ebrv6sjr6okpwidowsh5u6bz3i --otp
}

# Get AWS session token with MFA
def sts [] {
  let token = (mfa)

  let sts_response = (
    ^aws --profile prod sts get-session-token
      --serial-number "arn:aws:iam::911070201873:mfa/phone"
      --token-code $token
      --duration-seconds 43200
      --output json
    | from json
  )

  let access_key = $sts_response.Credentials.AccessKeyId
  let secret_key = $sts_response.Credentials.SecretAccessKey
  let session_token = $sts_response.Credentials.SessionToken

  ^aws configure set aws_access_key_id $access_key --profile sts
  ^aws configure set aws_secret_access_key $secret_key --profile sts
  ^aws configure set aws_session_token $session_token --profile sts
  ^aws configure set region us-east-1 --profile sts
}

# AWS SSO login helper
def sso [profile: string] {
  let config = match $profile {
    "prod" => { profile: "prod", region: "us-east-1" },
    "dev" => { profile: "dev", region: "us-east-1" },
    "eu" => { profile: "eu", region: "eu-central-1" },
    _ => {
      print $"No matching profile and region for argument ($profile)"
      return
    }
  }

  $env.AWS_PROFILE = $config.profile
  $env.AWS_DEFAULT_REGION = $config.region

  print $env.AWS_PROFILE
  print $env.AWS_DEFAULT_REGION

  ^aws sso login --profile $profile
}

# Nushell config management
def nuconfig [] {
  ^$env.EDITOR ~/.config/nushell/config.nu
}

def nuenv [] {
  ^$env.EDITOR ~/.config/nushell/env.nu
}

# Create directory and file (like mkdir -p + touch)
def mkfiledir [path: string] {
  mkdir ($path | path dirname)
  touch $path
}

# Git checkout main or master
def gcm [] {
  if (git show-ref --verify --quiet "refs/heads/main" | complete | get exit_code) == 0 {
    git checkout main
  } else {
    git checkout master
  }
}

# Go to git root
def --env gu [] {
  cd (^git rev-parse --show-toplevel | str trim)
}

# Fuzzy find directory
def --env fz [] {
  cd (^fd --type d | fzf)
}

# Delete git branches
def gbr [] {
  git branch | rg -v "(^\\*|master|main)" | xargs git branch -D
}

# Copy last commit SHA
def lastsha [] {
  ^git rev-parse HEAD | tr -d '\n' | ^pbcopy
}

def push [] {
  git push origin (git rev-parse --abbrev-ref HEAD)
}

# Yazi with directory change
def --env y [...args] {
  let tmp = (mktemp -t "yazi-cwd.XXXXXX")
  yazi ...$args --cwd-file=$tmp
  let cwd = (open $tmp | str trim)
  if $cwd != "" and $cwd != $env.PWD {
    cd $cwd
  }
  rm -f $tmp
}

# Aliases
alias tf = terraform
alias vim = nvim
alias gs = git status
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
alias pn = pnpm
alias yolo = claude --dangerously-skip-permissions
alias touch = mkfiledir
alias oc = opencode
alias order-by = sort-by

def amend [] {
	git add -A
	git commit --amend --no-edit
}

def force [] {
	git add -A
	git commit --amend --no-edit
	git push --force-with-lease
}

def --env nvm [...args: string] {
  if ("NVM_DIR" in $env) {
    let nvm_script = $'
        source "($env.NVM_DIR)/nvm.sh"
        nvm  ($args | str join " ")
        env
    '

    ^bash -c $nvm_script
    | lines
    | parse "{name}={value}"
    | where name in ["NVM_DIR", "PATH", "NVM_BIN", "NVM_INC", "NVM_CD_FLAGS"]
    | transpose -r
    | into record
    | load-env

    return
  } 

  error make -u {
      msg: "nvm is not installed"
  }
}

