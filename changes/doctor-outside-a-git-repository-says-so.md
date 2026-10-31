**`ddd-ts-kit doctor` outside a git repository no longer claims the git hooks are in place.** It reports `hook git repository` as missing ("no git repository here: the hooks could not be read; `git init` comes first"), with the fix `git init` then `hooks:install`, and `--strict` exits 1; the summary line that names the hooks is printed only when they could be read.

To move: run `git init` before `hooks:install` in a project that has no repository yet.
