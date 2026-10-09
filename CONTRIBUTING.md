# Contributing

```bash
npm ci
npm run build
npm test
node packages/cli/dist/bin.js check --self
```

## Ground rules

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the single normative document. A change of
  rule starts there, then reaches the checker, the templates and the skills in the same pull
  request. The end-to-end test of the CLI (generate everything, then check) must stay green:
  the generator and the checker never disagree.
- A new check rule comes with a passing and a failing fixture, a `fix` sentence and an
  `explain` entry.
- A new template compiles as generated and carries `TODO(domain)` markers only where business
  knowledge is needed.
- Runtime packages keep third-party libraries behind optional peer dependencies and subpath
  entries. `@ddd-ts-kit/kernel` and the CLI have no runtime dependency.
- Skills stay short: they tell an agent what to run and what to decide, and point to the
  reference instead of repeating it.
- English everywhere. No em dash or en dash (CI checks it).
- Conventional commits: `<type>(<scope>): <summary>`.
- A pull request that changes the plugin (skills, agents, hooks) bumps `version` in
  `plugin/.claude-plugin/plugin.json`.
