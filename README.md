# dotfiles

My MacOS development environment. 

## Quick Start

Everything is managed by the `dot` script (shamelessly copied from [here](https://github.com/dmmulroy/.dotfiles/blob/main/dot))

```bash
# Initialize everything (Homebrew, packages, dotfiles, OpenCode, SSH key)
dot init

# Update dotfiles and packages  
dot update

# Check system health
dot doctor
```

## Core Commands

### Initialization
- `dot init` - Full setup: Homebrew, packages, stow dotfiles, Bun, OpenCode, SSH key
- `dot init --skip-ssh` - Initialize without SSH key generation

### Package Management
- `dot package list` - Show all packages in bundle files
- `dot package add <name>` - Install and add package to bundle (auto-detects brew/cask)
- `dot package add <name> cask work` - Add cask to work bundle
- `dot package remove <name>` - Remove from bundle, optionally uninstall
- `dot package update` - Update all installed packages
- `dot package update <name>` - Update specific package

### System Management
- `dot update` - Pull repo changes, update packages, re-stow dotfiles
- `dot doctor` - Comprehensive health check (Homebrew, Stow, OpenCode, SSH, dev tools)
- `dot stow` - Create/refresh symlinks for dotfiles
- `dot check-packages` - Show installed vs missing packages from bundles
- `dot retry-failed` - Retry previously failed package installations

### Git Integration
- `dot summary` - AI-powered summary of last 3 commits (uses OpenCode)
- `dot summary -n 5 -d` - Detailed summary of last 5 commits with diffs
- `dot gen-ssh-key` - Generate SSH key (prompts for email)
- `dot gen-ssh-key user@example.com` - Generate SSH key with specific email

### Utilities  
- `dot edit` - Open dotfiles directory in $EDITOR
- `dot link` - Install dot globally in PATH
- `dot unlink` - Remove global dot installation

## Package Bundles

Packages are organized in bundle files:
- `packages/bundle` - Base packages (general development tools)
- `packages/bundle.work` - Work-specific packages

Package commands auto-detect formula vs cask and maintain sorted order.

## OpenCode Integration

dot installs and integrates with [OpenCode](https://opencode.ai) for AI-powered development assistance:
- Native installer preferred (fastest updates)
- Automatic fallback to Homebrew/Bun/npm
- `dot summary` uses OpenCode to analyze git commits
- `dot doctor` checks OpenCode installation and suggests optimizations

## Directory Structure

```
dotfiles/
├── dot              # Main script (symlink as dot)
├── home/            # Files to stow to $HOME
├── packages/        # Package bundle files
│   ├── bundle       # Base packages
│   └── bundle.work  # Work packages
└── backups/         # Automatic backups of replaced files
```

## SSH Key Management

`dot gen-ssh-key` creates Ed25519 keys with smart naming:
- Extracts domain from email for key naming
- Adds to ssh-agent automatically  
- Copies public key to clipboard
- Provides platform-specific instructions

## Installation Health

`dot doctor` performs comprehensive checks:
- Homebrew installation and functionality
- GNU Stow availability
- OpenCode installation method and conflicts
- SSH key presence
- Development tools availability
- Symlink integrity
- PATH configuration

The doctor command provides specific remediation steps for any issues found.

## Examples

```bash
# Full setup on new machine
dot init

# Add development tools
dot package add neovim
dot package add docker cask
dot package add kubectl brew work

# Daily maintenance
dot update
dot doctor

# Git workflow
dot summary -n 5        # Summarize recent work
dot gen-ssh-key work@company.com

# Package management
dot package list work   # Show work packages
dot package update git  # Update specific package
dot retry-failed       # Retry any failed installs
```

Run `dot help` for complete command reference.
