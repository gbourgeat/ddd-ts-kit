# Contributing

```bash
npm ci
npm run build
npm test
npm run lint
npm run format:check
node packages/cli/dist/bin.js check --self
npm run check:dashes
node --test plugin/hooks/guard.test.mjs
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
- A page of documentation says what the code does today: a sample compiles against the
  current packages, a command runs as written, and what could not be verified is said on the
  page. [docs/README.md](docs/README.md) is the index.
- English everywhere. No em dash or en dash (`npm run check:dashes`, run by CI).
- Conventional commits: `<type>(<scope>): <summary>`.
- A pull request that changes the plugin (skills, agents, hooks) bumps `version` in
  `plugin/.claude-plugin/plugin.json`, and passes `claude plugin validate . --strict`.

## How a change reaches `main`

`main` is protected: no direct push, no force push, a linear history. A change arrives through
a pull request whose title is a conventional commit subject, is squashed into one commit, and
merges once the `gate` job of the CI, the title check and the CodeQL analysis have passed and
every review conversation is resolved. Enable auto-merge and move on:

```bash
gh pr create --fill
gh pr merge --auto --squash
```

Workflows pin each action to a commit, with its version in a comment; Dependabot proposes the
updates. A vulnerability is reported privately: see [SECURITY.md](SECURITY.md). Conduct:
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Releasing

The packages of `packages/` are released together, under one version.

```bash
node pipeline/monorepo/release-version.mjs --set 0.2.0   # every manifest and the versions the CLI writes
npm install --package-lock-only
# pull request, merge, then on main:
git tag v0.2.0 && git push origin v0.2.0
```

The tag starts the `Release` workflow: it checks that the tag is the version every package
states, builds, checks the tarballs, publishes each package to the npm registry with provenance
and creates the GitHub release. A version with a pre-release part (`0.2.0-rc.1`) is published
under the `next` tag. A run that stopped half-way is run again: what is already published is
skipped. The workflow needs the `NPM_TOKEN` secret of the `npm` environment.

