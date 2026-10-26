**`ddd-ts-kit acceptance <story> --lock` writes the lock in the layout the formatter of the project prints.**
The lock was written with `JSON.stringify` in two spaces, which the Biome of the project then refused at the commit (the format hook asked for `biome format --write` on every lock and every relock). It is written through the JSON layout the kit uses for its other generated files, the one `biome format` prints at a width of 120, so the format hook passes on it untouched.

To move: nothing; a lock already written is reformatted by the next `acceptance <story> --lock`, or by `biome format --write test/acceptance/*.acceptance.lock.json`.
