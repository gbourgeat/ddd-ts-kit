<!-- The title is a conventional commit subject: it becomes the subject of the squashed commit. -->

## What changes and why

## How it was verified

- [ ] `npm run build && npm test`
- [ ] `node packages/cli/dist/bin.js check --self` and `npm run check:dashes`
- [ ] a rule change starts in `docs/ARCHITECTURE.md` and reaches the checker, the templates and the skills here
- [ ] a plugin change bumps `version` in `plugin/.claude-plugin/plugin.json`
- [ ] the documentation says what the code does after this change
