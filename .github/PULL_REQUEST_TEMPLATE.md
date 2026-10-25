<!-- The title is a conventional commit subject: it becomes the subject of the squashed commit. -->

## What changes and why

## How it was verified

- [ ] `npm run build && npm test`
- [ ] `node packages/cli/dist/bin.js check --self` and `npm run check:dashes`
- [ ] a rule change starts in `docs/ARCHITECTURE.md` and reaches the checker, the templates and the skills here
- [ ] what it changes for a user is in a file of `changes/` (a plugin change too), `CHANGELOG.md` and the plugin version left to the release
- [ ] the documentation says what the code does after this change
- [ ] a line added to `pipeline/monorepo/families.mjs` or `packages/cli/test/support/support-matrix.ts` is a gap that cannot be filled here, its reason checked in the code (the run annotates each one)
