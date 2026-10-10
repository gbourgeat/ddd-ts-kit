# Pipeline

Reusable quality gates for a project built with ddd-ts-kit: the analyzers, their configuration,
the git hooks and the CI definition for GitHub and for GitLab. `ddd-ts-kit init` installs
them in a project (`--ci github|gitlab|both|none` chooses the platform files), adapted to its
stack. Three files of this directory are not what a project receives: the table says which.

The rule of the whole directory: **CI logic lives in npm scripts**. The two platform files only
orchestrate (order, caches, services, reports). They call the same `ci:*` scripts, so they stay
equivalent and cannot drift, and every gate runs on a laptop with the same command.

## Where each file goes

| Here | In the project | Role |
|---|---|---|
| `eslint.config.mjs` | `eslint.config.mjs` | ESLint with `@ddd-ts-kit/eslint-plugin` |
| `depcruise-config.mjs` | not installed | a standalone dependency-cruiser configuration that reads `ddd-ts-kit.config.json` each time it is loaded. A project gets `.dependency-cruiser.cjs` instead, written from the config by `ddd-ts-kit depcruise-config --write` (`init` and `generate context` write it) and held current by `depcruise-config --check` |
| `knip.json` | `knip.json` | dead code and unused dependencies |
| `vitest.config.ts` | `vitest.config.ts` | `unit` and `integration` projects, coverage thresholds per layer |
| `lefthook.yml` | `lefthook.yml` | git hooks |
| `commitlint.config.mjs` | `commitlint.config.mjs` | conventional commits, shared by the hook and both CI title checks |
| `renovate.json` | `renovate.json` | dependency updates, on either platform |
| `package-scripts.json` | merged into `package.json` | the `ci:*` scripts and the dev dependencies they need. In a project `ci:arch:graph` is `npm run depcruise`, that is `ddd-ts-kit depcruise-config --check && depcruise src --config .dependency-cruiser.cjs`; this file still names `depcruise-config.mjs` |
| `github/workflows/*.yml` | `.github/workflows/` | `ci.yml`, `codeql.yml`, `pr-title.yml` |
| `github/dependabot.yml` | `.github/dependabot.yml` | GitHub-native alternative to Renovate |
| `github/branch-protection.md` | read once | the settings that make the workflow binding |
| `gitlab/.gitlab-ci.yml` | `.gitlab-ci.yml` | the same pipeline for GitLab. The installed file writes the architecture report with `ddd-ts-kit check --format gitlab`; the file here still converts a JSON report in two steps |
| `gitlab/arch-to-codequality.mjs` | not installed | converts a saved `ddd-ts-kit check --format json` report to a Code Quality report; `check --format gitlab` makes it unnecessary in a pipeline |
| `gitlab/merge-request-settings.md` | read once | the settings that make the pipeline binding |
| `monorepo/` | not templated | scripts of this repository's own pipeline |

## The gates

Costs are wall-clock times of each command on a generated project of three contexts (87
TypeScript files), on a developer machine, measured when the ESLint plugin held 23 rules; it
holds more today and the lint time was not measured again. They give the order of magnitude,
not a benchmark.

| Order | Gate | Script | Catches | Cost |
|---|---|---|---|---|
| 1 | typecheck | `ci:typecheck` | everything the compiler knows, with the native TypeScript 7 | 0.4 s |
| 1 | lint | `ci:lint` | layer and context imports, purity of the inner layers, stepdown order, function and file size, layout, comments, escape hatches, aggregate and value object shape, handler shape, ports and declarations, access control, events, jobs; typescript-eslint strict with types | 4.5 s |
| 1 | architecture | `ci:arch:check` | the tree, `CONTEXT.md`, the glossary, names, required specs and builders, event declarations, the declarations barrel, where adapters are bound, the config and its deviations | 0.3 s |
| 1 | architecture | `ci:arch:graph` | a `.dependency-cruiser.cjs` that no longer matches the config, then the resolved import graph: the same layer and context rules through barrels, cycles, orphans, dev dependencies and test files imported by production code, undeclared packages | 0.8 s |
| 1 | dead code | `ci:deadcode` | unused files, exports, types and dependencies | 0.6 s |
| 2 | unit tests | `ci:test:unit` | behaviour of the domain, the application and the routes; coverage thresholds of these three layers | seconds |
| 3 | integration tests | `ci:test:integration` | adapters against a real PostgreSQL; coverage threshold of `infrastructure/` | tens of seconds |
| 4 | end-to-end tests | `ci:test:e2e` | the whole application through HTTP and the event bus | tens of seconds |
| 2 | docs and contract drift | `ci:docs` | a stale context map, `CONTEXT.md` list, OpenAPI document, AsyncAPI document or event catalog | a build |
| 1 | security | `ci:audit`, gitleaks, platform scanners | a high or critical advisory in a production dependency, a committed secret | seconds |
| 5 | build | `ci:build` | the production build | a build |
| 6 | image | platform-native | the `Dockerfile` still builds; nothing is pushed | a minute |
| last | gate | none | needs every job: the single required check | none |

Jobs of the same order run in parallel. The fast static gates run first and gate the tests, so
a layer violation fails in seconds with its own job name instead of after the test suite.
Security starts with the static gates and does not wait for them. `ci:docs` runs after the
static gates, beside the tests.

### Three analyzers, one set of rule ids

| Tool | Reads | Authority for |
|---|---|---|
| `ddd-ts-kit check` | paths, text, `CONTEXT.md`, the config | the structure of the project and what is true of the project as a whole; also a fast text-level guard for code rules in the editor hook |
| ESLint with `@ddd-ts-kit/eslint-plugin` | the syntax tree and the types of one file | code-level rules, with a message that says what to do instead |
| dependency-cruiser | the resolved module graph | what a per-file rule cannot see: barrels, cycles, orphans, package boundaries |

The same violation can be reported by two of them under the same id. That is deliberate: the
first one is the cheapest to run after each write, the last one is the hardest to fool. Which
rule id is held by which analyzer is in
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#who-checks-what); `npx ddd-ts-kit rules` lists
the ids.

### Coverage thresholds

`vitest.config.ts` sets thresholds per layer (statements, branches, functions, lines):

| Layer | Thresholds | Reason | Measured by |
|---|---|---|---|
| `domain/` | 90, 85, 90, 90 | pure code, no double needed: nothing prevents testing it | `ci:test:unit` |
| `application/` | 85, 80, 85, 85 | handlers run through fakes | `ci:test:unit` |
| `presentation/` | 80, 70, 80, 80 | mapping and status translation | `ci:test:unit` |
| `infrastructure/` | 70, 60, 70, 70 | driver error paths are hard to provoke | `ci:test:integration` (`--mode integration`) |

A freshly generated project passes them: the numbers leave room for the `it.todo` entries of the
scaffolds. Raise them once the todos are written.

### What a fresh scaffold reports

- A port, a fake or a domain service generated before anything uses it is an unused file for
  knip and an orphan for dependency-cruiser. Generate it with the use case that needs it.
- A few templates of the generator are reported by the type-checked lint (an unused import, a
  `void` operator, an unbound method). They are listed in the report of this work and are to be
  fixed in the templates, not silenced in the preset.

## TypeScript

typescript-eslint and dependency-cruiser read sources through the JavaScript API of the
compiler, which the native TypeScript 7 does not ship. `package-scripts.json` therefore installs
both: `typescript` 6 for the tools, `@typescript/native` (an alias of `typescript` 7) to compile
and type-check, called by its path. With `typescript` 7 alone, ESLint with types does not start.
The generated `.dependency-cruiser.cjs` asks for the `tsc` parser, that is the `typescript` 6
of the project. The standalone `depcruise-config.mjs` of this directory falls back to
`@swc/core` when it is installed (it then follows type-only imports without telling them apart)
and fails loudly otherwise: without a parser dependency-cruiser would read no TypeScript file
and report zero violation.

## Git hooks

`lefthook.yml`, installed once per clone with `npx lefthook install`:

| Hook | Runs | On |
|---|---|---|
| pre-commit | `eslint` | staged sources |
| pre-commit | `ddd-ts-kit check` | staged sources under `src/` |
| pre-commit | `ddd-ts-kit check --commit-size --staged` | the index: advice on the size of the commit, never a refusal |
| pre-push | `ci:typecheck`, `ci:test:unit` | the project |
| commit-msg | `commitlint` | the message |

`commitlint.config.mjs` is also what the pull request title check (GitHub) and the merge request
title check (GitLab) run: with squash merges the title becomes the commit on the default branch.

## GitHub and GitLab

| Piece | GitHub (`github/workflows/ci.yml`) | GitLab (`gitlab/.gitlab-ci.yml`) |
|---|---|---|
| Triggers | `push` to `main`, `pull_request` | `workflow: rules`: merge requests and the default branch |
| Redundant runs | `concurrency` with `cancel-in-progress` | `workflow: auto_cancel: on_new_commit: interruptible`, `default: interruptible: true` |
| Install and cache | `setup-node` with `cache: npm`, `npm ci` in each job | `.npm/` cache keyed on `package-lock.json`, written by `install`, read by the others |
| Fast DAG | `needs:` between jobs | `needs:` between jobs, stages for the gate |
| Typecheck, dead code, docs, audit, build | `npm run ci:*` | the same scripts |
| Lint report | annotations from the problem matcher of `setup-node` | `-- --format gitlab` (eslint-formatter-gitlab) into `artifacts:reports:codequality` |
| Architecture report | `ci:arch:check -- --format github` annotations | `ci:arch:check -- --format gitlab` into `artifacts:reports:codequality`, in one step (the file of this directory still runs `--format json`, then `arch-to-codequality.mjs`) |
| Test reports | the GitHub Actions reporter of Vitest; coverage as an artifact | `-- --reporter=junit` into `artifacts:reports:junit`; `coverage:` regex; Cobertura into `artifacts:reports:coverage_report` |
| PostgreSQL | `services: postgres`, reached on `localhost` | `services:` with the alias `postgres` |
| Secrets | the gitleaks image through `docker run`, full history | the same image as the job image, `GIT_DEPTH: 0` |
| Image build, no push | `docker/build-push-action` with `push: false` | BuildKit rootless (`buildctl-daemonless.sh`, `push=false`) |
| Title check | `pr-title.yml`: commitlint on the pull request title | `merge-request-title` job: commitlint on `CI_MERGE_REQUEST_TITLE`, Draft prefix removed |
| Gate | `gate` job, `if: always()`, fails unless every needed job succeeded | `gate` job alone in the last stage |
| Making it binding | `github/branch-protection.md`: `gate` as required check | `gitlab/merge-request-settings.md`: pipelines must succeed |
| Dependency updates | `renovate.json` or `dependabot.yml` | `renovate.json` |

The only step that is not an npm script is the image build: the builder is the platform's.
Report formats are the only arguments the YAML adds to a script.

On one platform only:

| Platform | Piece | Note |
|---|---|---|
| GitHub | CodeQL (`codeql.yml`) | free on public repositories, GitHub Code Security on private ones |
| GitHub | dependency review on pull requests | needs the dependency graph, same licence condition |
| GitHub | Dependabot | Renovate covers both platforms; keep one of the two |
| GitHub | a required check per job | GitLab requires the pipeline as a whole |
| GitLab | SAST and Secret Detection templates | run on every tier; findings in the merge request need Ultimate |
| GitLab | Dependency Scanning template | Ultimate only; `npm audit` is the fallback on every tier |
| GitLab | Code Quality, JUnit and coverage widgets in the merge request | every tier; the inline view of Code Quality needs Ultimate |
| GitLab | push rules for commit messages | Premium and Ultimate; the hook and the title check hold the rule elsewhere |

The GitLab template jobs never block a merge (`allow_failure` by design of GitLab). What blocks
on every tier is `audit` (npm audit) and `secrets` (gitleaks), the same two checks as on GitHub.

Kaniko is not used for the image: its repository is archived. BuildKit is maintained and builds
without a privileged daemon.

## Mutation testing

Not shipped. Stryker 10 declares support for Vitest 2 and later but, run on the domain layer of
a generated project with Vitest 5, it executes no test per mutant and reports every mutant as
survived, including one that removes a guard a passing test asserts. Its core also rewrites the
tsconfig through an API the native TypeScript 7 does not have. A gate that scores zero whatever
the tests say is worse than no gate; it will be added as a scheduled job when the runner
supports Vitest 5.

## What was verified, and how

| Piece | Verification |
|---|---|
| ESLint preset and plugin | run on a generated project of three contexts, clean and with one deliberate violation per rule, when the plugin held 23 rules: all of them and the delegated typescript-eslint rules reported; also run under ESLint 9. The plugin holds 46 rules today (45 ids and the ceiling of `clean/function-size`); those added since were not run this way and are held by the plugin's own tests (`packages/eslint-plugin/test/rules`) |
| `depcruise-config.mjs` | run with dependency-cruiser 18 on the same project with the TypeScript 6 parser, and on a second one with `@swc/core`: every rule of the config reported its deliberate violation. The generated `.dependency-cruiser.cjs` is exercised by the end-to-end test of the CLI |
| `knip.json` | unused file, export, type and dependency reported |
| `vitest.config.ts` | both projects run with coverage; a threshold failure reported; JUnit and Cobertura files written |
| `arch-to-codequality.mjs` | run on real checker output: 34 issues with unique fingerprints, exit code 1 while errors remain |
| `check --format gitlab` | what the installed `.gitlab-ci.yml` runs; not executed on GitLab |
| eslint-formatter-gitlab | run under ESLint 10: report written to `ESLINT_CODE_QUALITY_REPORT` |
| workflows | parsed with a YAML parser, checked with actionlint 1.7 (no finding); not executed on GitHub |
| `.gitlab-ci.yml` | parsed with a YAML parser; stages, `needs` and `extends` resolved by a script; `glab ci lint` needs a GitLab project and was not run; not executed on GitLab |
| `renovate.json` | `renovate-config-validator --strict` |
| `lefthook.yml`, `commitlint.config.mjs` | `lefthook validate`; commitlint on a valid and an invalid message |
| branch protection, merge request settings | written from the API documentation, not executed |
