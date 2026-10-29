**`--force` never destroys work git does not hold, and no write of the CLI leaves the project.**

`init --force` and `generate --force` refuse, with exit code 2, the files named and nothing
written, while a file they would replace differs from the last commit: uncommitted, staged, or
untracked and not ignored (`Commit or stash them first, then run again: git diff shows what the
kit rewrote.`). A forced merge of `package.json` that writes the script, the range or the release
of the kit over one of the team counts as a replacement. Outside a git repository, `--force`
refuses to replace a file whose content would change. There is no way around it: commit, stash or
delete.

`init --force` no longer rewrites the files a team owns once written: `README.md`, `AGENTS.md`,
`CLAUDE.md`, `src/main.ts` and the pipeline definitions (`.github/workflows/`, `.gitlab-ci.yml`)
stay as they are, listed as `kept (yours since the first init)`; the jobs and includes of the
pipeline are the team's to edit, those of `--ci-extras` too. `.gitignore` and `.dockerignore`
keep the lines of the team and gain the lines of the kit they lack. A last note says how many files
`--force` rewrote and kept.

A file a generator leaves as it is reads `skipped <file> (exists, kept; --force replaces it once it
is committed)`, and the `.claude/settings.json` that `init` writes asks before `generate * --force*`,
`init --force*` and `init * --force*`, the allow rule of `generate` notwithstanding (`init` run
again adds the three rules to a project).

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
edited files commits first. `README.md`, the pipeline, `AGENTS.md`, `CLAUDE.md` and `src/main.ts`
are no longer rewritten by `init --force`: run `init` with the same flags in an empty folder and
diff it with the project to pick up what changed in them. Put the file or the folder itself in
place of a symbolic link a command of the kit writes through, and write each directory of the
config inside the project.
