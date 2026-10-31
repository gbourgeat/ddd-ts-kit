**The two hooks of the regulated profile wait for an input that arrives late, and `change-reference` watches every `Dockerfile`, `docker-compose*.yml` and `docker/` folder of the checkout and its worktrees.** `production-gate.mjs` no longer lets a command through when its input cannot be read: it refuses it with exit 2 and says so, and `change-reference.mjs` asks. `change-reference.mjs` also answers `MultiEdit`, reads a path from the checkout that holds the file (a worktree of the project, a session started in a subdirectory), and `story-check` reads the same places.

To move: the hooks are the team's files once `init` wrote them. Copy the reader and the `GATED` list of `packages/cli/templates/init/hooks/` into yours, and register `change-reference.mjs` on `Edit|Write|MultiEdit` in `.claude/settings.json`.

An input that is JSON but no object (`null`, a string, a number) is treated like an unreadable one, and the refusal says which error it was.
