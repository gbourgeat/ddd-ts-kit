# Declared style: the layouts of earlier versions

Read under `stack.dependencies: listed` (what a declared config without the key means), or when
`declarations/barrel-current` reports declarations an earlier version wrote. Why the defaults
changed and what each missing key is read as: `docs/CONFIG.md` of the kit, "A key left out of
`stack`"; how a constructor reaches the root: `docs/concepts/ports-and-composition.md`, "How the
constructor reaches the composition root".

## Dependencies listed in the decorators

`stack.dependencies: listed` is a 0.1 project: the decorators list their dependencies,
`@CommandHandler(Message, [Ports])`, in the order of the constructor. Keep the form the project
uses. To move to signatures:

```bash
# set "dependencies": "signature" under "stack" in ddd-ts-kit.config.json, then
npx eslint . --fix
npx ddd-ts-kit docs
```

## Declarations written by 0.84 to 0.86

A context still declared as an earlier version wrote it (the single `<context>.declarations.ts`
of 0.84, or one `<folder>.declarations.ts` per role folder as 0.85 and 0.86 wrote them) is a
warning of `declarations/barrel-current` in this version and an error in a later one.
`npx ddd-ts-kit docs` moves it to one `<layer>.declarations.ts` per layer, and the moved files are
committed together.
