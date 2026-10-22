**The report of a story carries the evidence of its verification.** The story template gains
`### Verification` under `## Report`: the story skill pastes there the last lines of
`npm run verify`, of the acceptance run and of `story-check`, and writes `not verified:` for what
it could not run (a broker, a provider, a platform), so that the pull request shows what the
toolchain said and not only that it was run. `npx ddd-ts-kit story <code> --gate close` reads it:
the `report` phase is met only when the block names `npm run verify`.

To move: a story opened before this version adds `### Verification` under `## Report` before its
pull request; `npx ddd-ts-kit story <code>` says when it is missing.
