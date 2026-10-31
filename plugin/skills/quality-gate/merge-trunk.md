# Bring the trunk in

Read when a branch has its rows committed and the trunk moved, before its review and its merge, or when `merge-trunk` stopped.

When the rows of a branch are committed, before its review and its merge: bring the trunk into
the branch with `npx ddd-ts-kit merge-trunk` (`--cwd <worktree>` from outside it), never
`git merge` alone; `--trunk <git-ref>` names the trunk when `git fetch origin` has not made it findable. It computes the
merge from the newest commit of the branch the trunk holds (a first row already squash-merged, a
branch it was stacked on), settles the derived files (the `package.json` of a client at the higher
of both versions), generated regions and registries, the rows
of `slices.md`, the drizzle-kit journal and the lockfile itself, and leaves each source or test
hunk in a merge in progress with what each side did there (exit 1). Resolve each hunk keeping
both sides, never by taking one side of a source file or a test (`-X theirs`, `-X ours`,
`checkout --theirs` erase the other side without a conflict, and the guard refuses them to a
sub-agent), `git add` it, then `npx ddd-ts-kit merge-trunk --continue`: it replays the
migrations, regenerates, runs `verify-merge` on the result and commits only once no line, row
or test is lost (a removal decided on purpose: `--continue --accept-lost`; `--abort` undoes, and restores the derived files the kit regenerated). On Prisma it also runs `npm run db:client` when the merge changed a schema, so the test database is current. When the trunk moved since the merge started, `--continue` says so: it concludes the commit of the first run, so run `merge-trunk` again after it.
Under the sandbox, a trunk that changes the settings of the project (`.claude/settings.json`) or
another path the session cannot write is the owner's merge: `merge-trunk` stops with nothing
changed and exit 3, naming the paths; hand the owner the same command to run from a terminal
outside the sandbox, and do not merge by hand or reset the worktree.
