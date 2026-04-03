# Zed Python support analysis

Repo inspected: `~/dev/zed`

## Bottom line

Zed does a lot more for Python than just wiring up an LSP.

Big buckets:

1. built-in Python language server management
2. Python-aware toolchain / virtualenv discovery + selection
3. terminal + task integration with the active interpreter
4. Python-specific runnable/test/debug scenario detection
5. debugpy bootstrapping
6. Jupyter / REPL integration for Python envs
7. grammar/editor ergonomics

### Important note on type stub downloads

I **did not find Zed-side code** that explicitly downloads Python third-party type stubs.

I searched for things like `typeshed`, `stubPath`, `types-`, `download.*stub`, `type stub`, etc. across the repo and found no Python-specific stub downloader in Zed's Rust code.

What I **did** find:

- Zed auto-installs/configures Python language servers
- Zed enables `autoSearchPaths`, `useLibraryCodeForTypes`, and `autoImportCompletions` for Pyright/BasedPyright
- Zed injects the active interpreter / venv into language-server config

So if you have seen “auto-downloading stubs” behavior in practice, it is likely coming from **basedpyright/pyright itself**, not from a Zed-specific implementation in this repo.

Relevant file:

- `crates/languages/src/python.rs`

### Important note on stub navigation (`.pyi` vs `.py`)

After a second pass, I also do **not** see evidence that Zed has Python-specific client logic that says “prefer `.pyi` targets for Go to Definition”.

What Zed appears to do instead:

- ask the active language server for **definition**, **declaration**, or **type definition**
- convert the LSP response into internal `LocationLink`s
- open the returned `target_uri` directly

Relevant files:

- `crates/editor/src/editor.rs`
- `crates/editor/src/hover_links.rs`
- `crates/project/src/lsp_command.rs`

That means if navigation lands in a stub file, the most likely cause is that **basedpyright returned a stub path**, not that Zed rewrote the target afterward.

Two important nuances:

1. **Shift-click in Zed is not the same as normal Go to Definition**.
   - In Zed's hover/click flow, normal click goes to **definition**.
   - **Shift-click** goes to **type definition**.
   - Type definition is much more likely to land in `.pyi` files.
   - Relevant file: `crates/editor/src/hover_links.rs`

2. **Zed injects the active interpreter / venv into basedpyright**.
   - Zed sends `venvPath`, `venv`, `python.pythonPath`, and `python.defaultInterpreterPath`.
   - That can change import resolution and navigation targets versus another editor using the "same" language server but not sending the same environment data.
   - Relevant file: `crates/languages/src/python.rs`

So if Zed opens a stub and Neovim does not, the difference is likely one of:

- Zed is doing **type definition** while Neovim is doing **definition**
- basedpyright is receiving **different interpreter / env config** in the two editors
- the language server itself is choosing `.pyi` because that package exposes stubs first

This also lines up with basedpyright/pyright behavior more generally: stubs and inline `.pyi` files are preferred ahead of library `.py` implementations during import/type resolution, and library code is used later as fallback.

---

## 1) Python is a first-class built-in language in Zed

Zed registers Python as a built-in language, not an extension-only integration.

What gets attached to Python by default:

- language servers: `basedpyright`, `ruff`, `ty`, `pylsp`, `pyright`
- Python task/context provider
- Python toolchain provider
- `pyproject.toml` manifest provider
- Python semantic token rules

Relevant files:

- `crates/languages/src/lib.rs`
- `assets/settings/default.json`
- `crates/language_onboarding/src/python.rs`

Notable defaults in `assets/settings/default.json`:

- formatter = Ruff LSP
- `source.organizeImports.ruff = true`
- debugger = `Debugpy`
- default language servers = `basedpyright` + `ruff`
- `ty`, `pyright`, `pylsp` disabled by default

There is also a Python-specific onboarding banner explaining the switch to basedpyright defaults:

- `crates/language_onboarding/src/python.rs`
- toolbar hookup in `crates/zed/src/zed.rs`

---

## 2) Zed ships deep integrations for multiple Python language servers

### 2.1 BasedPyright

`BasedPyrightLspAdapter` is the main Python LSP integration.

Relevant file:

- `crates/languages/src/python.rs`

What Zed does for it:

- auto-installs `basedpyright` via npm into Zed-managed storage
- can use a user-installed `basedpyright-langserver` if present
- sends Python-specific init options:
  - `autoSearchPaths = true`
  - `useLibraryCodeForTypes = true`
  - `autoImportCompletions = true`
- injects the active toolchain into workspace config:
  - `venvPath`
  - `venv`
  - `python.pythonPath`
  - `python.defaultInterpreterPath`
- if user has not set a type-checking mode, Zed sets basedpyright to `standard` instead of its stricter default
- disables basedpyright organize-imports so Ruff can own that job
- rewrites completion sorting because Pyright/BasedPyright sort text is unstable after `completion/resolve`
- generates nicer completion/symbol labels for Python items

This is one of the most opinionated Python-specific integrations in the repo.

### 2.2 Pyright

`PyrightLspAdapter` is still present as a built-in alternative.

Relevant file:

- `crates/languages/src/python.rs`

Zed does almost the same interpreter/venv injection as with basedpyright:

- `venvPath`
- `venv`
- `python.pythonPath`
- `python.defaultInterpreterPath`
- same Python init options
- same custom completion sorting/labeling
- npm-managed auto-install if needed

### 2.3 Ruff

`RuffLspAdapter` is not just “run Ruff somehow”; it is a pretty polished integration.

Relevant file:

- `crates/languages/src/python.rs`

What Zed does:

- auto-downloads Ruff binaries from GitHub releases, per OS/arch
- verifies cached binaries with digest metadata
- prefers a toolchain-local `ruff` binary when it exists beside the selected interpreter
- runs Ruff in LSP mode via `ruff server`
- asks Ruff for its config schema via `ruff config --output-format json`
- converts Ruff's flat schema into nested JSON schema so Zed settings UI can expose it cleanly

That schema conversion is a subtle but nice feature; it means Python users get much better editor-side config UX for Ruff.

### 2.4 Ty

Zed also has a built-in `ty` adapter.

Relevant file:

- `crates/languages/src/python.rs`

What is special here:

- auto-downloads platform binaries from GitHub releases
- prefers a toolchain-local `ty` binary if present
- injects active environment data in a `pythonExtension.activeEnvironment` shape
  - executable URI
  - `sysPrefix`

That suggests Zed is adapting to the config shape Ty expects from the VS Code Python ecosystem.

### 2.5 PyLSP

PyLSP is also integrated more deeply than just “spawn pylsp”.

Relevant file:

- `crates/languages/src/python.rs`

What Zed does:

- creates a Zed-managed private venv for PyLSP
- installs `python-lsp-server[all]`
- installs `pylsp-mypy`
- validates the resulting binary
- can use a `pylsp` inside the selected toolchain if found next to the interpreter
- injects selected interpreter into Jedi config
- injects `--python-executable` into `pylsp_mypy` overrides
- sets a Python-specific default config:
  - `pycodestyle` disabled
  - `rope_autoimport` enabled with `memory = true`
  - `pylsp_mypy` disabled by default
  - `rope.ropeFolder = null`

That `rope_autoimport` default is another concrete Python productivity enhancement.

---

## 3) Zed has Python-specific completion UX fixes

Relevant file:

- `crates/languages/src/python.rs`

Two notable Python-only tweaks:

### 3.1 Custom sorting for Pyright/BasedPyright completions

Zed ignores Pyright's raw `sortText` and re-sorts items itself because Pyright's ordering becomes unstable after resolve calls.

Zed prioritizes:

- named arguments
- local/internal items over auto-import items
- public over protected/private/dunder names
- kind-aware ordering

This is a real Python UX improvement, not generic LSP plumbing.

### 3.2 Better completion/symbol labels

Zed formats Python functions/classes/constants with Python-looking labels, not generic LSP ones.

Examples from code paths:

- functions render like `def foo():`
- classes like `class Foo:`
- constants like `NAME = 0`

---

## 4) Python toolchain / virtualenv support is deep and opinionated

This is probably the biggest “special thing” Zed does for Python.

Relevant files:

- `crates/languages/src/python.rs`
- `crates/toolchain_selector/src/active_toolchain.rs`
- `crates/toolchain_selector/src/toolchain_selector.rs`
- `docs/src/languages/python.md`
- `docs/src/toolchains.md`

### 4.1 Zed treats Python environments as toolchains

`PythonToolchainProvider` uses the `python-environment-tools`/`pet_*` stack to discover environments.

Environment kinds explicitly handled in code include:

- uv
- uv workspace
- Poetry
- Pipenv
- virtualenv / venv
- virtualenvwrapper
- Conda
- Pixi
- Pyenv / Pyenv virtualenv
- global installs from Homebrew / Python.org / CLT / Xcode / Windows registry/store / etc.

### 4.2 Heuristics for picking the “right” env

Zed does not just list envs; it sorts them with Python-aware heuristics.

Relevant file:

- `crates/languages/src/python.rs`

Priority inputs include:

- whether a `.venv` declaration matches the environment name
- how close the env is to the current subproject/worktree
- env kind priority (`uv`/Poetry/venv before Conda/global)
- `CONDA_PREFIX` matching for Conda envs
- executable path as tie-breaker

That is a real attempt to make Python projects “just work” without manual interpreter setup.

### 4.3 `pyproject.toml` is a first-class manifest anchor

Relevant files:

- `crates/languages/src/python.rs`
- `crates/languages/src/lib.rs`

Zed registers a `PyprojectTomlManifestProvider` and searches ancestors for `pyproject.toml`.

That gives Python projects a proper manifest/root concept in the same way Rust gets `Cargo.toml`.

### 4.4 Status bar + persistent toolchain selection

Relevant files:

- `crates/toolchain_selector/src/active_toolchain.rs`
- `crates/toolchain_selector/src/toolchain_selector.rs`
- `crates/zed/src/zed.rs`

What happens:

- active toolchain appears in the status bar
- Zed auto-picks a default when none selected
- non-global user toolchains are preferred for that default choice
- selection is persisted in the workspace DB
- clicking the status item opens the selector

This is effectively Zed's answer to “choose interpreter” in Python IDEs.

---

## 5) Zed auto-activates Python envs in terminals

Relevant files:

- `crates/project/src/terminals.rs`
- `crates/languages/src/python.rs`
- `crates/settings_content/src/terminal.rs`
- `crates/terminal/src/terminal_settings.rs`

This is one of the strongest Python-specific integrations.

When opening a terminal in a project, Zed:

- resolves the active Python toolchain
- asks the Python toolchain provider for shell-specific activation commands
- prepends activation commands before the terminal shell / task command

Supported activation logic includes:

- Conda / mamba / micromamba
- venv / virtualenv
- uv / uv workspace
- Poetry
- Pyenv

Details:

- shell-specific activation scripts are resolved for fish, nushell, powershell, cmd, posix shells, etc.
- micromamba gets a shell-hook bootstrap first
- activation commands are shell-quoted carefully
- there is test coverage for shell-injection safety on malicious Conda env names

This is much better than “just let the user set PATH manually”.

---

## 6) Python tasks are interpreter-aware and syntax-aware

Relevant files:

- `crates/languages/src/python.rs`
- `crates/grammars/src/python/runnables.scm`

`PythonContextProvider` builds Python task variables using the active toolchain.

Important behavior:

- `PYTHON_ACTIVE_ZED_TOOLCHAIN` resolves to the selected interpreter, else falls back to `python3`
- run selection uses that interpreter
- run file uses that interpreter
- run module uses `-m <module>` with module name computed from relative path
- test tasks support both `pytest` and `unittest`
- runner choice comes from the `TEST_RUNNER` task variable

The runnable query (`runnables.scm`) detects:

- `unittest.TestCase` subclasses
- unittest methods named `test*`
- pytest functions named `test_*`
- pytest classes named `Test*`
- pytest methods
- `if __name__ == "__main__":` entry points

So Zed can generate Python run/debug actions from syntax, not from brittle regexes.

---

## 7) Python debugging is deeply integrated via debugpy

Relevant files:

- `crates/dap_adapters/src/python.rs`
- `crates/project/src/debugger/locators/python.rs`
- `crates/grammars/src/python/debugger.scm`
- `crates/grammars/src/python/config.toml`
- `docs/src/languages/python.md`

### 7.1 Zed auto-bootstraps debugpy

`PythonDebugAdapter` does real dependency management:

- creates a base venv under Zed's debug adapter storage
- uses selected toolchain interpreter when available, else system Python
- fetches latest debugpy version info from PyPI JSON
- `pip download`s the wheel
- extracts it into Zed-managed storage
- reuses cache when possible

This is analogous to how Zed manages language servers, but for the Python debugger.

### 7.2 Toolchain-aware interpreter selection for debugging

Zed tries to resolve the active Python toolchain based on:

- `cwd`
- `program`
- `module`
- relative paths inside the worktree

Then it uses that interpreter to launch Python/debugpy.

So debug runs are tied to the right env, not just the shell's random `python`.

### 7.3 Auto-generated debug scenarios from Python tasks

`PythonLocator` converts Python task templates into debug scenarios when possible.

It understands:

- script runs
- module runs (`-m module`)
- pytest/unittest-generated tasks

It intentionally skips `python -c ...` selections because those are not practical debug targets.

### 7.4 Python-specific debugger tree-sitter query

`crates/grammars/src/python/debugger.scm` marks:

- candidate local variables
- assignment targets
- loop variables
- scopes
- `self`

This is debugger-oriented Python syntax intelligence, not generic parsing.

---

## 8) Zed's REPL/Jupyter story is Python-aware

Relevant files:

- `crates/repl/src/repl_sessions_ui.rs`
- `crates/repl/src/repl_store.rs`
- `crates/repl/src/kernels/mod.rs`
- `crates/repl/src/repl_editor.rs`
- `crates/repl/src/components/kernel_options.rs`
- `docs/src/repl.md`

### 8.1 Opening a Python buffer refreshes Python kernels

When the active editor is a Python file, Zed refreshes Python kernelspecs for that worktree.

### 8.2 Python envs become kernel candidates

Zed synthesizes Jupyter kernel specs from discovered Python toolchains.

For local envs it:

- checks `import ipykernel`
- builds an `ipykernel_launcher` argv
- injects `PATH`
- injects `VIRTUAL_ENV`
- labels the env by environment kind when possible

For remote/WSL projects it builds remote/WSL kernel entries too.

### 8.3 Missing `ipykernel` is handled gracefully

This is a very nice Python-specific feature.

Python environments appear in the kernel picker **even when `ipykernel` is missing**.

UI behavior:

- envs without `ipykernel` are dimmed
- label says `ipykernel not installed`
- selecting one triggers automatic `pip install ipykernel`
- after install, Zed immediately assigns the env as the active kernel

Relevant files:

- `crates/repl/src/repl_editor.rs`
- `crates/repl/src/components/kernel_options.rs`

### 8.4 Kernel recommendation follows the active toolchain

`ReplStore` prefers:

1. Python env matching active toolchain + has `ipykernel`
2. first Python env with `ipykernel`
3. generic language-matching Jupyter kernel fallback

That makes the REPL align with the same interpreter the editor/LSP/tasks use.

---

## 9) Python grammar/editor ergonomics go beyond syntax highlight

Relevant files:

- `crates/grammars/src/python/config.toml`
- `crates/grammars/src/python/injections.scm`
- `crates/grammars/src/python/outline.scm`
- `crates/grammars/src/python/imports.scm`
- `crates/grammars/src/python/debugger.scm`
- `crates/grammars/src/python/runnables.scm`
- `crates/grammars/src/python/semantic_token_rules.json`
- plus other Python grammar queries in `crates/grammars/src/python/`

Notable Python-specific editor behavior:

### 9.1 File detection

Zed recognizes:

- `.py`
- `.pyi`
- `.mpy`
- shebangs with `python`
- shebangs using `uv run`

### 9.2 Python-specific bracket/autoclose handling

Configured bracket handling includes:

- prefixed strings: `f`, `b`, `u`, `r`, `rb`, `t`
- triple quotes
- normal quote pairs

### 9.3 Python indentation rules

Custom indent/deindent config exists for:

- `:` blocks
- `elif`
- `else`
- `except`
- `finally`

### 9.4 Outline/import intelligence

There are Python-specific queries for:

- outline items for classes/functions
- import extraction
- import path normalization via `import_path_strip_regex = "/__init__\\.py$"`

### 9.5 Embedded SQL highlighting inside Python strings

`injections.scm` supports SQL injection into Python strings when preceded by comments like:

- `# sql`
- `#sql`

That is a targeted Python productivity feature for DB-heavy code.

---

## 10) A few smaller but still notable Python niceties

### Python icon / type association

Relevant file:

- `assets/icons/file_icons/python.svg`

### Built-in support suppresses extension duplication

Relevant file:

- `crates/extension_host/src/extension_host.rs`

Zed suppresses extension-host copies of some Python tooling (`ruff`, `ty`, `basedpyright`) because it already has native integrations.

### Evaluator bootstrap preinstalls basedpyright

Relevant file:

- `crates/eval_cli/zed_eval/install.sh.j2`

This is not end-user editor behavior, but it shows the project treats Python LS bootstrapping as important enough to prewarm in some environments.

---

## 11) Answer to “what special things does Zed do for Python projects?”

If I compress the repo analysis to the most meaningful list, Zed does these Python-specific things:

1. **Auto-manages Python language servers**: basedpyright, Ruff, Ty, PyLSP, Pyright.
2. **Injects the active interpreter/venv into LS config**, so imports and types resolve against the right env.
3. **Uses Ruff as the default formatter/linter/import organizer**.
4. **Discovers Python environments automatically** across uv/Poetry/venv/Conda/Pyenv/etc.
5. **Chooses a default env heuristically** based on project proximity and env kind.
6. **Shows/selects the active toolchain in the UI**, persistently.
7. **Auto-activates the selected env in terminals**.
8. **Runs Python tasks/tests using the selected interpreter**.
9. **Detects pytest/unittest/module entry points from syntax**.
10. **Auto-generates debug scenarios** for scripts/modules/tests.
11. **Bootstraps debugpy automatically** in Zed-managed storage.
12. **Makes Python envs available as Jupyter kernels**.
13. **Auto-installs `ipykernel` on demand** when a Python env is chosen for REPL use.
14. **Tweaks Python completion ordering and labeling** for better UX.
15. **Adds Python grammar ergonomics** like `.pyi`, `uv run` shebangs, prefixed string autoclose, block indentation, embedded SQL highlighting.

---

## 12) My take on the type-stub question

If your mental model was “Zed itself downloads Python type stubs”, the repo does **not** support that strongly.

More accurate model:

- Zed manages/install/wires Python tooling
- Zed chooses the right interpreter/env
- Zed gives Pyright/BasedPyright helpful defaults (`autoSearchPaths`, `useLibraryCodeForTypes`, `autoImportCompletions`)
- actual stub behavior is likely delegated to the language server, not implemented directly in Zed
- `.pyi` vs `.py` navigation is also likely mostly language-server-driven, with Zed mainly acting as a transport/UI layer
- differences versus Neovim can come from Zed sending more complete interpreter/venv settings to basedpyright

So the standout Python differentiator in Zed's codebase is less “stub download logic” and more:

- **env/toolchain correctness**
- **Ruff + basedpyright defaults**
- **auto terminal/debug/REPL integration**
- **syntax-aware Python tasks/tests/debugging**

---

## Key files to read first

If I had to point at the most important Python files in the repo:

- `crates/languages/src/python.rs`
- `crates/languages/src/lib.rs`
- `assets/settings/default.json`
- `crates/dap_adapters/src/python.rs`
- `crates/project/src/debugger/locators/python.rs`
- `crates/project/src/terminals.rs`
- `crates/repl/src/kernels/mod.rs`
- `crates/repl/src/repl_editor.rs`
- `crates/repl/src/repl_store.rs`
- `crates/repl/src/components/kernel_options.rs`
- `crates/grammars/src/python/config.toml`
- `crates/grammars/src/python/runnables.scm`
- `crates/grammars/src/python/debugger.scm`
- `crates/grammars/src/python/injections.scm`
- `docs/src/languages/python.md`
- `docs/src/repl.md`
