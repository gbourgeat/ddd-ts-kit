**The `biome.json` of a project no longer ignores the worktrees of its own checkout.**
`init` wrote `"!**/.worktrees"` in `files.includes`: inside a worktree under `.worktrees/`, Biome then ignored every file, and `format` of `verify` failed in every story and worker. The entry is `"!.worktrees"`, anchored at the root of the configuration: the main checkout still skips its worktrees, and a worktree formats its own files.

To move: a project written before this change keeps `"!**/.worktrees"` in its `biome.json`; replace it with `"!.worktrees"` (or run `init --force`, which rewrites the file).
