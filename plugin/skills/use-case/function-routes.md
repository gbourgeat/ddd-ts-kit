# Function routes

Read under `stack.routes: functions` (what a config without the `routes` key means), before
writing the presentation of a slice. When a function route is still the right form, and a
worked one, are in `docs/concepts/presentation-layer.md` of the kit, "When to keep a function
route"; what follows is what changes in the slice.

- The route is a `defineRoute` function, listed in `<context>.routes.ts`, with `actorOf(...)`
  and its `security`: there is no route group to inherit it from.
- The permission stays on the command, as in a controller.
- Both forms run in one project: `generate controller` writes a controller whatever the key
  says, and `npx ddd-ts-kit controllers <context>` turns the function routes of a context into
  controllers when the team decides to move.
