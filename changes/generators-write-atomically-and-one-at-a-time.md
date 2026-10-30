**`init` and `generate` write each file whole, two generators on one project no longer lose each other's entries, and `plan-waves` never copies what a symbolic link points at.**

Each file `init` and `generate` write goes to `<name>.<random>.tmp` beside it, then is renamed into
place, so that a command stopped half way leaves complete files only, never a truncated one that
the next run would keep as existing; the same command run again writes the files still missing. A
file written over keeps its mode, and a link that stays inside the project is still written
through.

`init` on a project already initialised, and each `generate` of a kind that writes shared files
(`writesShared` in `generate --help --json`: the config, the composition root, the code list and
permission set of a context, the barrels), hold the lock of the project, `.ddd-ts-kit/lock`, which
the `.gitignore` of a project already ignores. Two such commands started at once in one checkout
now run one after the other: the second waits up to five seconds, then exits 2 with
``Another generator holds the lock of this project: `ddd-ts-kit generate context billing` (pid 1234, started 12 seconds ago). This command waited for it and wrote nothing.``
and the fix: run the generators one after the other. A lock whose command has ended on the same
machine, or taken more than a minute ago, is taken over.

The copy of the project `plan-waves` replays the planned commands in leaves symbolic links out: a
tracked link to a file outside the project (a key of the home folder) is no longer copied into the
temporary directory.
