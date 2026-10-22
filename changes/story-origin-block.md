**A story records where it comes from and what built it, in `## Origin` of its file.** The story
template gains the block, three lines: `From:` (the intent, the ticket or the incident the story
comes from), `Built with:` (the version of the kit and of the plugin, the base and its commit) and
`Policies in force:` (the skills loaded at the design phase). The story skill fills it at phase 1
and repeats it at the top of the body of the pull request, so that the trunk links back to the
origin of each story. `npx ddd-ts-kit story <code> --gate close` has a new phase, `origin
recorded`: it exits 1 until the block holds its `From:` and `Built with:` lines.

To move: a story opened before this version adds `## Origin` to `docs/architecture/stories/<code>.md`
before its pull request; `npx ddd-ts-kit story <code>` says what the block lacks.
