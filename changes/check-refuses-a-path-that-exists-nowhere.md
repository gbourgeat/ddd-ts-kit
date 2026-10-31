**`check` and `check-file` refuse a path that exists nowhere.** A mistyped or moved path used to read as "0 errors" with exit 0, which the skills take as the proof that a file is clean; it is now an error naming the path, with exit 2. `check-file --content-from` still accepts a path that is not written yet. `lint` of a pattern that matches no file already answered with one sentence and no stack.

To move: a hook or a script that called `check-file` on a path that may not exist yet passes the text with `--content-from`.
