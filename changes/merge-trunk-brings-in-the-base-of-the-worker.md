**`ddd-ts-kit merge-trunk` without `--trunk` brings in the base of the worker of the worktree.** It read `origin/HEAD`, then `origin/main`, whatever `.ddd-ts-kit/worker.json` named as `base`, the ref `worker-scope` cut the branch from, where `verify-merge` already reads it: a worker cut from another branch than the default one was given the default one. `--trunk` still names any other ref.

To move: a worker stacked on the branch of another worker has that branch as its base. Once that branch landed, name the trunk: `npx ddd-ts-kit merge-trunk --trunk origin/main`.
