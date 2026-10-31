**`ddd-ts-kit init` no longer accepts in silence two choices that do nothing.** `--orm none --event-sourcing on` is kept and now says in a note that the events of an event-sourced aggregate, their only record, live in memory and are lost when the process stops. `--allow-no-outbox "<reason>"` on a stack that keeps the outbox (no `--events in-memory`, or no ORM) is refused with exit 2, since no deviation exists to record there and the reason would be lost.

To move: drop `--allow-no-outbox` from a command that does not also ask for `--events in-memory` with an ORM.
