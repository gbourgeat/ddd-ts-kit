**`story-scope` records what a story is and where it comes from.** `npx ddd-ts-kit story-scope
<code> --kind story|fix --from <file>`: `--kind` is `story` by default, or `fix` for a story built
behind the regression specs listed under `## Regression` of its file (the `fix` skill); `--from`
names an intent, `docs/architecture/intents/<slug>.md`, refused unless its header says
`Status: accepted`, or an incident record, `docs/architecture/incidents/<id>.md`, accepted as it
is. `.ddd-ts-kit/story.json` gains `kind` and, when given, `from` (relative to the project root),
both kept when the story resumes without them; while the story file does not exist, the `Next:`
line says that the story skill seeds its statement from the origin. `npx ddd-ts-kit story <code>`
reads a fix as one: its rows and their design are optional, its acceptance phase reads
`## Regression` (each spec listed must exist) instead of `test/acceptance/`, and no passing phase
is read.
