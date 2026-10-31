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
   code change needs the build, the tests and the lint. Each package is held to 100 percent of its lines
   (`vitest.config.ts`): new code comes with its specs. A check no spec can reach is removed, or left
   out in [the decision record of the measure](docs/adr/0001-lines-left-out-of-the-coverage-measure.md),
   never moved onto a line that already runs. The hooks of the plugin are held to 100
   percent of their lines, branches and functions (`npm run test:plugin`): a branch no test
   reaches fails it, and a branch no hook input can reach is removed.
4. **Open a pull request.** Its title is a conventional commit subject; its template asks what
   changes, why, and how it was verified. Every pull request is reviewed by the maintainer.

Kinds of contribution that are especially welcome:

- an adapter for a broker, an ORM, an HTTP framework or a validation library the kit does not
  support yet: it implements the port and passes the contract suite of that port;
- tests for the branches of a package that no spec takes yet;
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
npm run check:parity
npm run docs:translations
npm run docs:samples
npm run test:plugin
```

`npm run lint` is ESLint with a content cache (`.eslintcache/`, 1 to 2 seconds when nothing changed). The
pre-commit hook and the Lint job of a pull request run Oxlint instead (`npm run lint:oxlint`, type-aware, with the rules
of the kit as a JS plugin, configured by `.oxlintrc.json`); the trunk and the night run ESLint on the whole tree, which
also holds `no-unsafe-enum-assignment`, and the trial job compares the two. A change of `eslint.config.mjs` reaches
`.oxlintrc.json` in the same commit. Vitest keeps the transformed modules of the sources in `node_modules/.vitest-cache`
(on by default, ignored by git, not kept by the pipeline): it makes a second run of one package about 40 percent
faster, and `rm -rf node_modules/.vitest-cache` empties it.

`zero-violation.spec.ts` and `formatted.spec.ts` generate every stack: they run in the end-to-end shards
only (`DDD_TS_KIT_E2E=1`), not in `npm test` nor in the pre-push hook.

### Heavy commands on a workstation

A run of the unit suite, of the integration suite or of a family of end-to-end specs takes 2.5 to
7 GB, and several of them at once (several coding sessions, a pre-push hook beside a run) have
restarted a desktop. Two things bound them:

- **One lock for the machine.** The `ci:test:*` scripts and the unit step of the pre-push hook
  run under `pipeline/monorepo/heavy-lock.sh`, which holds one of two slots (lock files in
  `$XDG_RUNTIME_DIR`, `DDD_TS_KIT_HEAVY_SLOTS` changes the number): a third heavy command waits for
  a slot and says so, instead of adding its memory to the others. Any other heavy command goes
  through it by hand, a Stryker run of the example for one:
  `bash pipeline/monorepo/heavy-lock.sh npm run test:mutation`. In a pipeline (`CI` set), or
  without `flock`, the command runs at once.
- **Two Vitest workers in the end-to-end scripts.** `ci:test:e2e`, `ci:test:e2e:stacks` and the
  other `ci:test:*` scripts of the families start `VITEST_MAX_WORKERS=2`, so the projects they
  generate do not each take half the cores. Set `VITEST_MAX_WORKERS` yourself to change it.

## Ground rules

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the single normative document. A change of
  rule starts there, then reaches the checker, the templates and the skills in the same pull
  request. The end-to-end test of the CLI (generate everything, then check) must stay green:
  the generator and the checker never disagree.
- The members of a family of packages (the four ORM, the brokers, the loggers) are at parity:
  an option, or a capability of a contract, that one member has, the others have too, or
  `pipeline/monorepo/families.mjs` says, member by member, why not. `npm run check:parity` fails
  on an asymmetry nobody wrote down, and on a written one that is no longer true. A behaviour of
  an adapter is proven by the contract of its port in `@ddd-ts-kit/testing`, never by a spec of
  one package alone: a new option comes with the capability of the contract that proves it,
  which every member then runs.
- What `init` and the presets refuse, and what the members of a family of flags (the ORM, the
  containers, the HTTP frameworks, the brokers, the runners...) generate differently, is written
  in `packages/cli/test/support/support-matrix.ts`, each line `decided` or `not yet` with its
  reason. `support-matrix.spec.ts` tries every flag and every pair of flags, and generates each
  member of a family with every capability on: a refusal, a platform todo or a package of the kit
  that no line explains fails, and so does a line that no longer holds. A `not yet` line is a gap
  that stays in sight until a pull request fills it and removes the line. The same spec generates
  every kind in a multi-tenant project on each ORM and reads every call of the generated code to a
  class or function of the kit whose options take a `tenant` (read from the sources of the
  packages): a call without it fails, unless `TENANT_GAPS` says why.
- A line of those two registries turns a failing check green, so it is a decision of the
  maintainer, never the shortest way to a green pipeline: its reason says what the member does
  instead (a reason too short, or a promise for later, fails), the run of a pull request annotates
  each line it adds (`pipeline/monorepo/asymmetries.mjs`), and in Claude Code the hook of
  `.claude/settings.json` asks before any edit of them, whatever the permission mode.
- A new check rule comes with a passing and a failing fixture, a `fix` sentence and an
  `explain` entry.
- Before 1.0, a rule that prevents a problem is an error at once: a new rule takes `error` as its
  default (nothing in `default-severities.ts` for `ddd-ts-kit check`, `recommended: 'error'` for
  the ESLint rule), and so does what a rule judges more. There is no warning first and no version
  in which it becomes an error later: a rule left a warning to soften an upgrade is one that a
  project learns to ignore. A rule is `warn` only when what it reports may be right and a reader
  settles it (`privacy/*`, which reads names, or `tree/documented-paths`). Its file of `changes/` is
  breaking: it says what the rule reports, the fix, and a `To move:` line with
  `ddd-ts-kit check --rule <id>` to list the files to take up. A layout or a form an earlier
  version wrote is reported the same way, as an error, with the command that moves it
  (`ddd-ts-kit context-layout`, `ddd-ts-kit docs`); the kit reads it only so that this command
  can move it.
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
  are, with their checks still valid. The static checks job of the CI holds it
  (`node pipeline/monorepo/changes.mjs --check --base <ref>`).

## The eval suite of the plugin

The plugin is agent configuration: skills, agents, a hook. A change of wording can silently
break what a skill promises, and no unit test reads a skill. The suite under `plugin/evals/` is
its regression test, run by `claude plugin eval` (Claude Code 2.1.269 or later): each case is a
prompt put to a session on a fixture project, and graders that read what the session did. The
[AI-native SDLC playbook of Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)
asks for exactly this of any configuration that steers an agent.

A case is a directory of `plugin/evals/`:

- `case.yaml` names it and its scaffold script, `fixture.sh`, which sources
  `plugin/evals/lib/scheduling-example.sh` (the scheduling example copied into the empty
  workspace of the run, the `node_modules` of this repository linked so that `npx ddd-ts-kit` is
  the built CLI, one git commit) and plants what the case needs: a violation, a story, a lock;
- `prompt.md` holds the prompt, with `max_turns`, `timeout_seconds` and `allowed_tools` in its
  front matter (`Bash`, `Edit` and `Write` are granted at run time with `--allow-tools`);
- `graders/*.md`, one grader per file: deterministic ones first (`tool_used` with an
  `input_match`, `regex` on the last message or on a file, `file_exists`), then one `llm` judge
  for what only a reading can tell. A case passes when its score reaches the threshold.

Three rules hold the suite. Every regression a user reports on a skill, an agent or the hook
becomes a case before it is fixed, named after the promise it holds. Each run has two arms, with
the plugin and without it (the no-plugin baseline): a case the baseline arm also passes measures
nothing, and is retired or sharpened until it tells the two apart. A case stays cheap: a precise
prompt, a bounded number of turns, the example as the fixture rather than a project to generate.

**The suite is off by default.** It spends API credits: each case is a full Claude Code session,
run in both arms and `--runs` times (3 by default), so the twelve cases are 24 sessions with
`--runs 1` and 72 with the default, and a nightly run of twenty cases would be sixty sessions a
night. Nothing runs on a pull request, on a schedule, or in `npm test`. A maintainer runs it by
hand from the Actions tab (the workflow `agent-evals.yml`, `workflow_dispatch` only) once the
secret `ANTHROPIC_API_KEY` exists in the repository; without the secret the job says so and ends
green. That run uses `--runs 1`, `--threshold 0.8` and a ceiling of 10 USD, uploads the report as
an artifact and writes the scores in its summary; the commented `pull_request` and `schedule`
triggers in the file show how to turn it on, with the cost stated next to them.

To run one case locally, on your own credential, with the CLI built (`npm run build`):

```bash
claude plugin eval plugin --runs 1 --no-publish --max-cost-usd 5 --case describe-not-tree-walk \
  --scaffold --allow-tools Bash Write Edit --trust-plugin --output-dir /tmp/ddd-ts-kit-evals
```

`--scaffold` runs the `fixture.sh` of the case (never pass it for a suite you did not read),
`--max-cost-usd` is a hard ceiling, and `--output-dir` keeps the results out of the tree
(`plugin/evals/results/`, the default, is ignored by git but read by `npm run check:dashes`).
A shell grant needs the sandbox of Claude Code, `bubblewrap` and `socat` on Linux: without them
the run is refused rather than run unconfined, and a case that grants no tool (`deviation-refused`)
still runs. One case, once, while writing it: the whole suite is the maintainer's run. The
format of a case is checked without running anything: `claude plugin eval` has no dry run, so
parse each `case.yaml`, the front matter of each `prompt.md` and of each grader with a YAML
parser, and compare with the template `claude plugin eval init --bare <name>` writes.

## How a change reaches `main`

`main` is protected: no direct push, no force push, a linear history. A change arrives through
a pull request whose title is a conventional commit subject, is squashed into one commit, and
merges once the `gate` job of the CI, the title check and the CodeQL analysis have passed and
every review conversation is resolved. Enable auto-merge and move on:

```bash
gh pr create --fill
gh pr merge --auto --squash
```

What the CI runs depends on the pull request (`docs/proposals/generated-project-families.md`). Open it
as a draft until the branch is final: a draft runs the fast checks only, and marking it ready runs the
whole CI. A pull request that changes documents alone, the website, the plugin text or the example
generates no project; one that touches anything under `packages/` or `pipeline/`, or the root
configuration, generates a cover of 16 stacks in which every value of every flag
appears. The trunk generates every stack, installs on npm and runs the alias on Node 24; the night and
the pull request of a release (title `chore(release)` or branch `release/*`) add pnpm, Node 22, the
intermediate states of the first minute, the coverage gate on ten stacks, the pairs and the migrations.

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

The pull request of a release (its title starts with `chore(release)`) runs the generated
projects on Prisma and TypeORM installed for real, as the night does (`npm run
ci:test:stacks-at-night`) the stacks that meet every pair of capability values (`npm run
ci:test:pairwise`) and the first migration of each ORM on a real PostgreSQL (`npm run
ci:test:migrations`): the pipeline of another pull request only type-checks the first and leaves
the second to the night. The tag
starts the `Release` workflow: it runs them once more and publishes nothing while one of them is
red (tag once the `managers`, `pairwise` and `migrations` jobs of the pull request of the release are green, or a
run of the night asked on `main`, `gh workflow run ci.yml --ref main`: the tag points at
that code; if `generated-stacks` still fails, nothing reached npm, so fix on `main`, delete the
tag, `git push --delete origin v0.2.0 && git tag -d v0.2.0`, and tag the fixed commit with the
same version), then checks that the tag is the version every package states, builds, checks the tarballs,
publishes each package to the npm registry with provenance
and creates the GitHub release. A version with a pre-release part (`0.2.0-rc.1`) is published
under the `next` tag. A run that stopped half-way is run again: what is already published is
skipped. The notes of the GitHub release are generated from the merged pull requests;
`CHANGELOG.md` at the root says in a few lines what a version changes for a user: setting the
version folds the files of `changes/` into it, in the order they reached `main`, and deletes them;
the CLI package ships a copy, which agents read in `node_modules`. The plugin is released with the
packages, under their version: setting it also writes `version` of
`plugin/.claude-plugin/plugin.json` and the version the skills describe, in
`plugin/hooks/guard.mjs`, so that every agent shows one number. The plugin numbered itself apart
until then, ahead of the packages: the first common version is above its version, which `--set`
holds (it names the first version it accepts), and `--expect` of the release workflow holds the
plugin to the tag. An urgent fix of the plugin is a patch release of the kit, not a version of
its own.

**No secret.** The workflow publishes through trusted publishing (OIDC): each package names
`release.yml` of this repository, in its `npm` environment, as its trusted publisher, and
`npm publish` exchanges the identity token of the job for a token that lives for that one
publication. The job that publishes keeps `id-token: write` and `environment: npm`, installs and
builds nothing (a first job, without the identity, installs, builds and packs, and the publishing
job publishes its tarballs), and needs npm 11.5.1 or later, which it checks. No `NPM_TOKEN` is stored anywhere.

**The approval of the owner.** The publish job runs in the `npm` environment, which requires the
approval of the owner of the repository: a run of `Release` stops before it publishes until the
owner approves it in the Actions tab, and nothing reaches npm without that approval. Only an
administrator of the repository creates a `v*` tag (a ruleset refuses it to everyone else), so a
release starts from an administrator, then waits for the owner. The tarballs a run packs are kept a week: an approval later than that, or a run finished after it,
runs the whole workflow again. Do not approve a run you did not expect.

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

