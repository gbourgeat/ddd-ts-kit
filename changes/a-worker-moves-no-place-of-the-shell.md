**A worker sets no variable that moves where the shell or git find their places, and a `cd` that CDPATH sends elsewhere is uncertain.** `TMPDIR`, `CDPATH`, `HOME`, `GIT_DIR`, `GIT_WORK_TREE` and `PATH`, set for a command, on their own or exported, are refused to a worker: the guard reads the places of a command by their values when the session started. A relative `cd` that a folder of `CDPATH` holds lands where only the shell knows, so what follows it is judged as a place only the shell knows.

To move: a worker that set one of these variables in a command runs it without, from its worktree.
