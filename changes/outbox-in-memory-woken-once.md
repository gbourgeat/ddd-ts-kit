**A project without a database (`--orm custom` or `none`) and with `--cache redis` compiles again: its outbox relay is woken by its own store alone.**

`main.ts` (and the `main.ts` of each extracted service) gave the relay two `wakeOn` keys, the signal of the in-memory persistence and the Redis signal, which TypeScript refuses (`An object literal cannot have multiple properties with the same name`). An outbox kept in the memory of the process is relayed by that process alone, so the Redis signal, which wakes the relay of another process, is no longer created there; with a database it stays. Found by the stacks that now meet every pair of capability values, generated and type-checked at night and before a release.

To move: on such a project, `init --force` writes `main.ts` and the Redis services again; by hand, remove `wakeOn: redis.relaySignal` from `main.ts`.
