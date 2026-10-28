**`--force` never destroys work git does not hold, and no write of the CLI leaves the project.**

`init --force` and `generate --force` refuse, with exit code 2, the files named and nothing
written, while a file they would replace differs from the last commit: uncommitted, staged, or
untracked and not ignored (`Commit or stash them first, then run again: git diff shows what the
kit rewrote.`). A forced merge of `package.json` that writes the script, the range or the release
of the kit over one of the team counts as a replacement. Outside a git repository, `--force`
refuses to replace a file whose content would change. There is no way around it: commit, stash or
delete.

Every file `init` and `generate` write stays inside the project: a file that is a symbolic link,
or a path that leads out of the project through one (a linked `docs/adr`, a `.claude/settings.json`
linked to the settings of a home directory), refuses the command with exit code 2 and the path
named, before anything is written. `init` refuses a home directory and the root of the file
system: run it in the directory of the project.

The directories of the config (`sourceRoot`, `contextsDir`, `sharedKernelDir`, `platformDir`)
are read with `.` and `..` resolved, and one that is absolute or leads above the root once
resolved (`"contextsDir": "src/../../escaped"`) stops every command that writes with exit code 2;
`check` reports it as `config/valid`.

To move: commit before `init --force` or `generate --force`, and a script that ran `--force` over
edited files commits first; put the file or the folder itself in place of a symbolic link a
command of the kit writes through; write each directory of the config inside the project.
