**English** · [Français](CONTRIBUTING.fr.md)

# Contributing

Thank you for taking the time. ddd-ts-kit is built in the open, and every contribution counts: a
bug report with a reproduction, a typo, a translation, a test, an adapter, a rule. This page says
how to start, then the rules every change follows.

## Your first contribution

1. **Pick something.** Issues labelled
   [good first issue](https://github.com/gbourgeat/ddd-ts-kit/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
   need no deep knowledge of the checker; those labelled
   [help wanted](https://github.com/gbourgeat/ddd-ts-kit/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
   are larger. Say on the issue that you take it, so that two people do not do the same work. For
   an idea that has no issue yet, open a
   [discussion](https://github.com/gbourgeat/ddd-ts-kit/discussions) or a proposal first.
2. **Set up.** Fork the repository, clone it, and run the commands below: they are what CI runs.
   Node 22.12 or later.
3. **Change, then check what you touched.** A documentation change needs `npm run check:dashes`,
   `npm run docs:translations` and, if it has a checked code sample, `npm run docs:samples`; a
   code change needs the build, the tests and the lint. Each package is held to a coverage floor
   (`vitest.config.ts`): new code comes with its specs.
4. **Open a pull request.** Its title is a conventional commit subject; its template asks what
   changes, why, and how it was verified. Every pull request is reviewed by the maintainer.

Kinds of contribution that are especially welcome:

- an adapter for a broker, an ORM, an HTTP framework or a validation library the kit does not
  support yet: it implements the port and passes the contract suite of that port;
- tests for the parts of a package that run without a server, where its coverage floor is low;
- documentation: a page that was unclear to you, a missing example, a translation;
- feedback from a real project: what held, what got in the way, in
  [Discussions](https://github.com/gbourgeat/ddd-ts-kit/discussions).

You do not write French? Say so in the pull request: the French page can be written in the same
pull request by the maintainer.

## Commands

```bash
npm ci
npm run build
npm test
npm run lint
npm run format:check
node packages/cli/dist/bin.js check --self
npm run check:dashes
npm run docs:translations
npm run docs:samples
node --test plugin/hooks/guard.test.mjs
```

## Ground rules

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the single normative document. A change of
  rule starts there, then reaches the checker, the templates and the skills in the same pull
  request. The end-to-end test of the CLI (generate everything, then check) must stay green:
  the generator and the checker never disagree.
- A new check rule comes with a passing and a failing fixture, a `fix` sentence and an
  `explain` entry.
- A change that makes the checks report what they did not (a new rule, a rule that judges more
  files, a lower limit) never turns a green project red in a patch or a minor version: what it
  adds reaches projects as a warning first, and becomes an error one minor version later. A new
  rule takes `warn` as its default (`default-severities.ts` for `ddd-ts-kit check`, `recommended:
  'warn'` for the ESLint rule); a rule that judges more reports what it adds under a rule id of
  its own, a warning, merged into the rule at the next minor version. Its file of `changes/` says
  it, and the one that makes it an error says it again: what the rule reports, the fix, and `ddd-ts-kit check --rule <id>` to list
  the files to take up before it blocks. A project builds while it upgrades; a rule that lands
  as an error stops its main branch and every branch cut from it.
- A new template compiles as generated and carries `TODO(domain)` markers only where business
  knowledge is needed.
- Runtime packages keep third-party libraries behind optional peer dependencies and subpath
  entries. `@ddd-ts-kit/kernel` and the CLI have no runtime dependency.
- Skills stay short: they tell an agent what to run and what to decide, and point to the
  reference instead of repeating it.
- A page of documentation says what the code does today: a sample compiles against the
  current packages, a command runs as written, and what could not be verified is said on the
  page. [docs/README.md](docs/README.md) is the index.
- English in code, commit messages, the CLI and the checker. Every page of documentation has
  a French translation next to it (`X.fr.md`), kept current in the same pull request: see
  [docs/translation.md](docs/translation.md) for the conventions, the glossary, the style of
  the diagrams and the checked code samples (`npm run docs:translations` and
  `npm run docs:samples`, run by CI).
- The documentation website (`site/`, published at <https://gbourgeat.github.io/ddd-ts-kit/>)
  is built from these same pages, which stay its only source. `npm run site:dev` assembles the
  pages and serves the site at `http://localhost:4321/ddd-ts-kit/` (run it again after changing
  a page); `npm run site:build` builds it as CI does, and fails on a link or an anchor that
  leads nowhere. A new page gets its route in `site/scripts/routes.mjs`. The card a shared link
  shows is drawn in `site/src/assets/social-card.svg`; `npm run social-card --workspace site`
  renders it to the committed `site/public/social-card.png`.
- No em dash or en dash, in any language (`npm run check:dashes`, run by CI).
- Conventional commits: `<type>(<scope>): <summary>`.
- What a pull request changes for a user is written in a file of its own,
  `changes/<what-it-does>.md` ([changes/README.md](changes/README.md)), never in `CHANGELOG.md`;
  a pull request that changes the plugin (skills, agents, hooks) has one, leaves `version` of
  `plugin/.claude-plugin/plugin.json` alone, and passes `claude plugin validate . --strict`. Two
  pull requests then never write the same line: one merged leaves the others mergeable as they
  are, with their checks still valid. The docs job of the CI holds it
  (`node pipeline/monorepo/changes.mjs --check --base <ref>`).

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
skipped. The notes of the GitHub release are generated from the merged pull requests;
`CHANGELOG.md` at the root says in a few lines what a version changes for a user: setting the
version folds the files of `changes/` into it, in the order they reached `main`, and deletes them;
the CLI package ships a copy, which agents read in `node_modules`. The plugin is released with the
packages, under their version: setting it also writes `version` of
`plugin/.claude-plugin/plugin.json` and the version the skills describe, in
`plugin/hooks/guard.mjs`, so that every agent shows one number. A version is above the plugin's
(it numbered itself up to 0.77.0, so the first common version is 0.78.0 or later), and `--expect`
of the release workflow holds the plugin to the tag. An urgent fix of the plugin is a patch
release (`--set 0.78.1`), not a version of its own.

**No secret.** The workflow publishes through trusted publishing (OIDC): each package names
`release.yml` of this repository, in its `npm` environment, as its trusted publisher, and
`npm publish` exchanges the identity token of the job for a token that lives for that one
publication. The job keeps `id-token: write` and `environment: npm`, and needs npm 11.5.1 or
later, which it checks. No `NPM_TOKEN` is stored anywhere.

**A new package.** Trust is declared per package, and only for a package that exists on the
registry. Before the first release that contains a package added to `packages/`, a maintainer
reserves its name with a placeholder `0.0.0`, deprecated, and declares the workflow as its
trusted publisher; the real versions are then published by the workflow, with provenance:

```bash
mkdir /tmp/reserve && cd /tmp/reserve
npm init -y --scope=@ddd-ts-kit && npm pkg set name=<package> version=0.0.0 license=MIT
npm publish --access public --tag reserved
npm deprecate <package>@0.0.0 "Placeholder that reserves the name: install a released version."
npm trust github <package> --file release.yml --repository gbourgeat/ddd-ts-kit --environment npm --allow-publish
```

Until that is done the release fails on that package alone, and the publish step names it;
running the failed job again after the declaration publishes it and skips the others.

