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
| `../biome.json` (the root of this repository) | `biome.json` | the formatter: Biome with its linter and its import organiser off, line width 120. The template the CLI ships is the same file, byte for byte; it is not copied here because Biome accepts one root configuration per repository |
| `knip.json` | `knip.json` | dead code and unused dependencies |
| `vitest.config.ts` | `vitest.config.ts` | `unit` and `integration` projects; what is measured and the thresholds are read from `coverage` in `ddd-ts-kit.config.json` (`governedCoverage` of `@ddd-ts-kit/testing/coverage`), per context and layer |
| `lefthook.yml` | `lefthook.yml` | git hooks |
| `commitlint.config.mjs` | `commitlint.config.mjs` | conventional commits, shared by the hook and both CI title checks |
| `renovate.json` | `renovate.json` | dependency updates, on either platform |
| `package-scripts.json` | merged into `package.json` | the `ci:*` scripts and the dev dependencies they need. In a project `ci:arch:graph` is `npm run depcruise`, that is `ddd-ts-kit depcruise-config --check && depcruise src --config .dependency-cruiser.cjs`; this file still names `depcruise-config.mjs` |
| `github/workflows/*.yml` | `.github/workflows/` | `ci.yml`, `pr-title.yml` and `copilot-setup-steps.yml` (the environment of the Copilot cloud agent); `codeql.yml` with `--ci-extras codeql` only; `claude-review.yml` and `claude-triage.yml` with `--ci-extras claude-review` and `claude-triage` only; `intent-to-spec.yml` with `--ci-extras intent-to-spec` only (the headless design pass of the story skill on each intent a merge accepts, see the [story workflow](../docs/guides/story-workflow.md)). `ci.yml` here is the default: the CLI's template adds the dependency review step under `--ci-extras dependency-review` |
| `github/dependabot.yml` | `.github/dependabot.yml` | GitHub-native alternative to Renovate |
| `github/branch-protection.md` | read once | the settings that make the workflow binding |
| `gitlab/.gitlab-ci.yml` | `.gitlab-ci.yml` | the same pipeline for GitLab, without the opt-in templates of GitLab's scanners (`--ci-extras gitlab-sast,...` adds them). The installed file writes the architecture report with `ddd-ts-kit check --format gitlab`; the file here still converts a JSON report in two steps |
| `gitlab/claude-review.gitlab-ci.yml` | `.gitlab/claude-review.gitlab-ci.yml` | with `--ci-extras claude-review` or `claude-triage` only: the two jobs that run Claude Code headless, included by `.gitlab-ci.yml`; the file here holds both, the CLI's template writes the ones asked for |
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
| 1 | format | `ci:format` (in the lint job) | a file that is not laid out the way the formatter prints it: Biome, line width 120 | 0.2 s |
| 1 | architecture | `ci:arch:check` | the tree, `CONTEXT.md`, the glossary, names, required specs and builders, event declarations, the declarations barrel, where adapters are bound, the config and its deviations | 0.3 s |
| 1 | architecture | `ci:arch:graph` | a `.dependency-cruiser.cjs` that no longer matches the config, then the resolved import graph: the same layer and context rules through barrels, cycles, orphans, dev dependencies and test files imported by production code, undeclared packages | 0.8 s |
| 1 | dead code | `ci:deadcode` | unused files, exports, types and dependencies | 0.6 s |
| 2 | unit tests | `ci:test:unit` | behaviour of the domain, the application and the routes; coverage thresholds of these three layers, per context (`--mode unit`) | seconds |
| 3 | integration tests | `ci:test:integration` | adapters against a real PostgreSQL; coverage threshold of `infrastructure/`, per context (`--mode integration`) | tens of seconds |
| 4 | end-to-end tests | `ci:test:e2e` | the whole application through HTTP and the event bus | tens of seconds |
| 2 | docs and contract drift | `ci:docs` | a stale context map, `CONTEXT.md` list, OpenAPI document, AsyncAPI document or event catalog, and a client of the contract that differs from it when the config has `sdk` | a build |
| 1 | security | `ci:audit`, gitleaks, and the opt-in scanners of the platform | a high or critical advisory in a production dependency, a committed secret | seconds |
| 5 | build | `ci:build` | the production build, and with `sdk` the clients of the contract, each compiled with its own options (`sdk:build`); publishing one stays manual ([client SDK](../docs/tools/client-sdk.md#publish)) | a build |
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

`lefthook.yml`, installed once per clone with `npx lefthook install`. Its line
`lefthook: node_modules/.bin/lefthook` makes the hook, shared by every worktree of the
repository, run the lefthook of the checkout it fires in: a checkout without its dependencies
fails the commit instead of skipping the checks.

| Hook | Runs | On |
|---|---|---|
| pre-commit | `eslint` | staged sources |
| pre-commit | `ddd-ts-kit check` | staged sources under `src/` |
| pre-commit | `ddd-ts-kit check --commit-size --staged` | the index: advice on the size of the commit, never a refusal |
| pre-commit | `secrets`: `gitleaks git --pre-commit --staged --redact --no-banner` when the `gitleaks` binary is on the path (`gitleaks protect --staged` before 8.19) | the staged changes: a secret refuses the commit before it exists. Without the binary the job prints one line saying the staged changes are not scanned here, and passes: the `secrets` job of the pipeline scans the whole history anyway. After the AI-native SDLC playbook of Anthropic ([PDF](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)): a credential is kept out of the diff at the commit, not found in CI |
| pre-push | `ci:typecheck`, `ci:test:unit` | the project |
| pre-push | `ddd-ts-kit verify-merge --warn` | the merges since the trunk: what each lost, shown without blocking in this version; silent without a merge |
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
| Lint cache | `actions/cache/restore` on a pull request, `actions/cache/save` on the default branch and the night, keyed by the lockfile and the lint config | a second `cache:` entry of the lint job, `policy: pull` on a merge request and `pull-push` on the default branch (`LINT_CACHE_POLICY`, set by the workflow rules) |
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

## Free by default, paid on request

The pipelines `init` writes use only tools that cost nothing on any repository, public or
private. A tool that needs a paid plan on a private repository, or whose findings only reach a
merge request in a paid tier, is offered and never installed by default: `init --ci-extras
<name>,...` adds it, and `ci.extras` of `ddd-ts-kit.config.json` records it ([CONFIG](../docs/CONFIG.md)).
The kit's own repository is public: its own workflows keep CodeQL and dependency review, which
cost nothing there.

| Job or file | Tool | Class | Condition (source) |
|---|---|---|---|
| every job | GitHub Actions, GitLab CI | the platform | Actions is free on public repositories with standard runners; on a private one each account has included minutes and storage (GitHub Free: 2,000 minutes, 500 MB), beyond which use is billed [1]. GitLab compute minutes follow the plan of the namespace: not re-checked here |
| typecheck, lint, format, architecture, dead code, tests, build, docs | TypeScript, ESLint, Biome, `ddd-ts-kit`, dependency-cruiser, knip, Vitest or Jest | free, open source, run in the job | none |
| `security`, `audit` | `npm audit` (`pnpm audit`) | free, run in the job | asks the advisory database of the public npm registry |
| `security`, `secrets` | gitleaks CLI, image `ghcr.io/gitleaks/gitleaks` | free, MIT, run in the job | none [2]. The `gitleaks/gitleaks-action` wrapper is not used: it asks organizations for a license key, which its README calls free; its own licence changed from MIT at 2.0 [3] |
| `image` | Docker Buildx and `docker/build-push-action` (GitHub), BuildKit rootless (GitLab) | free, open source, run in the job | the GitHub cache (`type=gha`) counts against the cache storage of the account [1] |
| test, coverage and Code Quality reports (GitLab) | `artifacts:reports` | free on every tier | Code Quality findings show in the merge request reports on every tier; the inline changes view is Ultimate [4] |
| `dependabot.yml` | Dependabot version updates | GitHub-native | dependency graph and Dependabot alerts are included in all plans [5]; the cost of version updates on a private repository is not stated on the pages read, and was not verified |
| `renovate.json` | Renovate | free, AGPL-3.0, self-hosted or the app hosted by Mend [6] | whether the hosted app is free on each platform was not verified |
| opt-in `codeql` | CodeQL, `.github/workflows/codeql.yml` | free on public repositories only | a private repository needs a GitHub Code Security license [7][5] |
| opt-in `dependency-review` | `actions/dependency-review-action`, a step of `security` | free on public repositories only | a private repository needs GitHub Code Security or GitHub Advanced Security [8] |
| opt-in `gitlab-sast` | `Jobs/SAST.gitlab-ci.yml` | runs on every tier, report only in Free and Premium | Free and Premium: open-source analyzers and a downloadable JSON report; findings in the merge request and vulnerability management are Ultimate [9]. Its jobs never fail a pipeline |
| opt-in `gitlab-secret-detection` | `Jobs/Secret-Detection.gitlab-ci.yml` | runs on every tier, report only in Free and Premium | JSON artifact on every tier; merge request reports and vulnerability management are Ultimate [10]. The `secrets` job (gitleaks) already blocks a leak on every tier |
| opt-in `gitlab-dependency-scanning` | `Jobs/Dependency-Scanning.v2.gitlab-ci.yml` | Ultimate | the feature is Ultimate only [11]; the include is skipped where `GITLAB_FEATURES` lacks it |
| opt-in `claude-review` | `anthropics/claude-code-action` on `pull_request` (`.github/workflows/claude-review.yml`); a `claude-review` job calling `claude -p` on a merge request (`.gitlab/claude-review.gitlab-ci.yml`) | API tokens on every run | the review of each pull or merge request by Claude Code, posted as one comment that neither approves nor blocks: the `gate` job never needs it, and a person still approves. The model is paid per token, through `ANTHROPIC_API_KEY` or through Amazon Bedrock, Google Vertex AI or Microsoft Foundry by the inputs the action documents [12]; the workflow runs for the repository's own branches only, since a fork cannot read the secret. It reads `REVIEW.md` at the root when it exists, and the story file the branch `story/<code>` names |
| opt-in `claude-triage` | `anthropics/claude-code-action` on `workflow_run` of `CI` ended in failure (`.github/workflows/claude-triage.yml`); a `claude-triage` job `when: on_failure` in the same GitLab file | API tokens on every failed run | a three-line triage (the most likely cause, flaky or real, what to do) written to the job summary and as a comment on the pull or merge request of the run, from the logs of the failed jobs, with read-only tools: nothing is changed and nothing is rerun by it. Never required by the `gate` job |
| opt-in `intent-to-spec` | the story skill of the plugin run headless by `claude -p` on a pull request merged into the default branch that accepts an intent of `docs/architecture/intents/` (`.github/workflows/intent-to-spec.yml`, GitHub only) | API tokens per accepted intent | the specification of a story (the questions with a provisional option, the rows, the design review, the acceptance locked) opened as a pull request whose body is the questions; the owner answers in the review and a person still approves; needs the `ANTHROPIC_API_KEY` secret and does nothing without it |
| not used | Codecov, Snyk, SonarQube Cloud, Chromatic and other hosted services | hosted services | none of them is installed or proposed by `init`; their terms were not read for this page |

What stands in the place of each opt-in by default: committed secrets are blocked by gitleaks
on both platforms; vulnerable dependencies by `npm audit` (production dependencies, high and
above), which also replaces dependency review on a pull request; no static security analysis
runs by default. That last gap is said rather than filled: the free engines that would fill it
either need the paid plan above to report into a pull request (CodeQL, GitLab SAST) or carry
rule licences that were not reviewed here (Semgrep's registry rules), and ESLint already holds
the purity and escape-hatch rules of the kit. A public repository gets CodeQL for free with
`--ci-extras codeql`.

Sources, read on 2026-10-12:
[1] GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions ;
[2] gitleaks: https://github.com/gitleaks/gitleaks ;
[3] gitleaks-action: https://github.com/gitleaks/gitleaks-action ;
[4] GitLab Code Quality: https://docs.gitlab.com/ci/testing/code_quality/ ;
[5] GitHub Advanced Security: https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security ;
[6] Renovate: https://docs.renovatebot.com/ ;
[7] code scanning: https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning ;
[8] dependency review: https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review ;
[9] GitLab SAST: https://docs.gitlab.com/user/application_security/sast/ ;
[10] GitLab pipeline secret detection: https://docs.gitlab.com/user/application_security/secret_detection/pipeline/ ;
[11] GitLab dependency scanning: https://docs.gitlab.com/user/application_security/dependency_scanning/ ;
[12] Claude Code GitHub Action, its `action.yml`, `docs/usage.md` and `docs/cloud-providers.md`, read on 2026-10-23: https://github.com/anthropics/claude-code-action .

On one platform only, whatever the plan:

| Platform | Piece | Note |
|---|---|---|
| GitHub | Dependabot | Renovate covers both platforms; keep one of the two |
| GitHub | a required check per job | GitLab requires the pipeline as a whole |
| GitLab | Code Quality, JUnit and coverage widgets in the merge request | every tier; the inline view of Code Quality needs Ultimate |
| GitLab | push rules for commit messages | Premium and Ultimate; the hook and the title check hold the rule elsewhere |

What blocks on every tier and every plan is `audit` (npm audit) and `secrets` (gitleaks), the
same two checks on both platforms.

Kaniko is not used for the image: its repository is archived. BuildKit is maintained and builds
without a privileged daemon.

## Mutation testing

Shipped as the job of the night: `mutation`, which runs `npm run test:mutation` on the default
branch when the schedule fires (GitHub) or when a pipeline schedule runs (GitLab), never on a pull
or merge request, and keeps `reports/mutation/` as an artifact for thirty days. The script runs
Stryker on the domain layer of every context, then `ddd-ts-kit mutation`, which holds each context
to the `mutation` floor of `ddd-ts-kit.config.json` (80 by the reference) and fails the job under
it. `init` writes `stryker.config.mjs`, which spreads `governedMutation()` of
`@ddd-ts-kit/testing/mutation` (the domain layers, the texts of refusals left out by the ignorer of the
kit, the static mutants ignored, the floor as `thresholds`), and `vitest.mutation.config.ts`, the unit specs alone;
`test/mutation-governed` refuses a setting written by hand. On both runners: a project on Jest gets
`jest.mutation.config.js` in place of the Vitest one, and its Stryker config passes the ES modules
flag to the processes that run the specs.

The measure that decided it, on 2026-10-24, on the example application
(`examples/scheduling`: Vitest 5.0.5, `typescript` 6.0.3 installed beside the native 7, the kit
from the workspace) with `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` 10.1.1,
published on 2026-10-23: no checker, `coverageAnalysis: perTest`, a Vitest config of its own
holding the unit specs alone (`src/**/*.spec.ts` without `test/integration/`), the domain layer of
the four contexts as `mutate` (`src/contexts/*/domain/**/*.ts` and
`src/contexts/*/*/domain/**/*.ts`), eight workers under `nice`, on an otherwise idle machine of
20 cores (load average from 0.8 to 12.2 during the run).

| Run | Files | Mutants | Killed | Survived | No coverage | Errors | Score | Time |
|---|---|---|---|---|---|---|---|---|
| the domain of `notification` | 12 | 104 | 103 | 1 | 0 | 0 | 99.0% | 25 s, the initial run of 119 tests taking 8 s |
| the domain of the four contexts | 127 | 1441 | 1347 | 72 | 6 | 16 | 94.5% | 8 min 2 s, the initial run of 1075 tests taking 54 s |
| the same with `governedMutation()` as first written, the `StringLiteral` mutator excluded, static mutants ignored, after the survivors of #269 were read | 110 | 1441, 222 of them ignored: 158 string literals, 64 static | 1178 | 36 | 5 | 0 | 96.6% | 4 min 2 s, the initial run of 1073 tests taking 65 s under the e2e suites of the kit; 3 min 44 s when repeated |
| the same with the ignorer of the kit in place of the excluded mutator, the shipped configuration: the texts of refusals alone left out, every other string measured | 110 | 1436, 163 of them ignored: 73 texts of refusals, 90 static | 1226 | 41 | 6 | 0 | 96.3% | 5 min 20 s under the unit suites of the kit, the initial run of 1073 tests taking 75 s; the configuration of the row above ran alone in 3 min 44 s |
| the same in incremental mode, nothing changed since the report it reuses | 127 | 1436, 1273 reused | 1226 | 41 | 6 | 0 | 96.3% | 1 min 30 s, the initial run of 1073 tests taking 84 s |
| the same after a change inside one file of the domain (`slot.vo.ts`) | 127 | 1436, 1266 reused, 7 run again | 1226 | 41 | 6 | 0 | 96.3% | 1 min 8 s |
| the same after a change of a builder alone | 127 | 1436, 1266 reused: the change was not seen | 1226 | 41 | 6 | 0 | 96.3% | 59 s |

The last row is what the night job measures: `ddd-ts-kit mutation` then holds each context to the
floor, `analytics` at 100.0%, `identity` at 97.9%, `notification` at 99.0%, `scheduling` at 95.4%,
every one above 80. The errors are gone with the static mutants, and the run takes about half the time.
What the score no longer sees: the 90 static mutants, those of code that runs once when the
module loads, 17 of them in the declaration of the appointment state machine, the rest in the
patterns and tables of value objects. A wrong transition in that table lowers no score, and the
test that states the transition is its only proof; `ddd-ts-kit mutation` shows the ignored mutants
of each context beside its score, so that the night says how much of the domain the score is silent
about.

The runner executes the tests per mutant, 4.9 and 17.9 on average: its code reads the test names
as Vitest 5 writes them (`vitest-test-runner.js` tells the separator of 5.0.0 apart), which the
10.0 tried earlier did not, when it reported every mutant as survived; that earlier run was not
repeated. The sandbox tsconfig is rewritten through the `typescript` 6 of the project, which the
native compiler does not provide: a project with the native 7 alone is not covered by this
measure. The 16 errors are the mutants of the declaration of the appointment state machine, which
the consistency check of `StateMachine` refuses when the module loads: neither a test failure nor
a survivor, and left out of the score. The 72 survivors: 29 string literals, the messages of
refusals, which no test asserts since a refusal is asserted by its code; 15 conditions, 6 regular
expressions, 5 equality operators and the rest in ones and twos, each a rule no test states, such
as a withdrawn reminder planned again for the same start that becomes planned again
(`reminder.aggregate.ts` of `notification`). Stryker estimates that the 423 static mutants, 29%
of them, take 92% of the time: `ignoreStatic` would shorten the run.

What shipping took, and why: a `mutation` key of `ddd-ts-kit.config.json` read by the Stryker
config the kit writes, a floor per context on the domain layer as the coverage has one, the static
mutants ignored, and the job of the night rather than a gate of every pull request, 8 minutes for
127 files being too long for the commit loop and for the pipeline of a small change. The texts of
the refusals decided the mutators: a test of the kit asserts a refusal by its code and its facts,
never by its text, so the string literal mutants of those texts, 29 of the 72 survivors here, would
stay alive in every project that follows the kit and a floor on the raw score would punish them or
push a team to assert prose. Excluding the `StringLiteral` mutator, the first answer, took every
string of the domain out of the measure, 158 on the example, the names of events, the statuses, the
codes and the keys among them, about a hundred of which the tests did kill. The shipped
configuration loads an ignorer of the kit instead (`refusal-texts`, in `appendPlugins` and
`ignorers`),
which leaves out the message of `refusal(..)`, a text handed to a factory of a refusal
(`InvalidSlot.forRule('ends after it starts')`), the message of `super(..)` in an error class and
of `new ..Error(..)`: 73 texts on the example, every other string measured. Six strings then
survive, each a rule no test states or an accident to leave alive and say so: the escaping of `%`
and `.` in the identifier of an attendance record (`attendance-record.aggregate.ts`, twice), the
zero a year is padded with in `time-zone.vo.ts` and its empty fallback, which no test reaches, and
the empty practice and patient of a record before its first fact. The appointment type of the
example throws where each rule is checked, as its other value objects do: its four texts, which a
helper returned before, are recognised now, and a project with such a helper has the same choice,
throw where the rule is checked or leave the survivor and say why.

A pull request gets a reading of its change, the three last rows measured it: Stryker's incremental
mode reuses the results of the report it is given for every mutant whose code and tests did not
change, relocating them in the changed files, so that a run costs its initial test run and the
mutants of the change alone, about a minute here instead of five. It diffs the mutated sources and
the specs alone: a change of a builder, a fake, a world, the platform or a dependency is not seen
and its results are reused stale, as the last row shows. The `mutation-changed` job therefore runs
with `DDD_TS_KIT_MUTATION_SINCE` set to the merge base of the change: `governedMutation()` turns
`incremental` on, and `force` too when the change touches code outside the domain sources and the
specs, so that such a change gets the whole run. The job restores the report of the last night
(`reports/mutation`, the artifact of the `mutation` job), then runs `npm run test:mutation`, whose
`ddd-ts-kit mutation` reads the same variable and lists the survivors of the files the change
touched (`--changed <base>` says it by hand), exiting 0 whatever the scores: a reading before the
review, never a gate, the floor being held by the night.

The Jest runner, measured the same day on a project `init` wrote on Jest (Express, zod, tsyringe,
Drizzle; one context with an aggregate, a value object and eleven specs) with
`@stryker-mutator/jest-runner` 10.1.1: 16 mutants, 14 killed, 2 survived, 1.59 tests per mutant
under `perTest`, one second. It took one setting: the specs are ES modules and run under
`--experimental-vm-modules`, which the `test` script passes to Jest; the flag on the `stryker`
process does not reach the processes it runs Jest in, and without it the initial run fails
(`ERR_REQUIRE_ESM` on `@ddd-ts-kit/testing`), so the config passes it as `testRunnerNodeArgs`.
`enableFindRelatedTests` lets Jest run the specs that import the mutated file; the plugin is found
under `@stryker-mutator/*` without being named.

## What was verified, and how

| Piece | Verification |
|---|---|
| `stryker.config.mjs`, `vitest.mutation.config.ts` or `jest.mutation.config.js`, the `mutation` job | `npm run test:mutation` run on the example with the shipped configuration (the section above); the generated files formatted and the project linted and dead-code checked on the stacks of `formatted.spec.ts` and `first-class.spec.ts`; the job parsed as YAML with the workflow, not executed on GitHub or GitLab |
| ESLint preset and plugin | run on a generated project of three contexts, clean and with one deliberate violation per rule, when the plugin held 23 rules: all of them and the delegated typescript-eslint rules reported; also run under ESLint 9. The plugin holds 76 rules today (75 ids and the ceiling of `clean/function-size`); those added since were not run this way and are held by the plugin's own tests (`packages/eslint-plugin/test/rules`) |
| `depcruise-config.mjs` | run with dependency-cruiser 18 on the same project with the TypeScript 6 parser, and on a second one with `@swc/core`: every rule of the config reported its deliberate violation. The generated `.dependency-cruiser.cjs` is exercised by the end-to-end test of the CLI |
| `knip.json` | unused file, export, type and dependency reported |
| `vitest.config.ts` | both projects run with coverage; a threshold failure reported; JUnit and Cobertura files written |
| `arch-to-codequality.mjs` | run on real checker output: 34 issues with unique fingerprints, exit code 1 while errors remain |
| `check --format gitlab` | what the installed `.gitlab-ci.yml` runs; not executed on GitLab |
| eslint-formatter-gitlab | run under ESLint 10: report written to `ESLINT_CODE_QUALITY_REPORT` |
| workflows | parsed with a YAML parser, checked with actionlint 1.7 (no finding); not executed on GitHub |
| `claude-review.yml`, `claude-triage.yml`, `claude-review.gitlab-ci.yml` | parsed with a YAML parser as the CLI writes them, every shell block checked with `bash -n`; actionlint was not installed on the machine of that change and did not run on them; the inputs of the action were read from its `action.yml` on 2026-10-23 and it is pinned to the commit of v1.0.259; not executed on GitHub or GitLab, and never run against the API |
| `intent-to-spec.yml` | parsed with a YAML parser as the CLI writes it; its `claude plugin marketplace add`, `claude plugin install` and `claude -p --permission-mode acceptEdits` lines were not executed anywhere; not executed on GitHub |
| `.gitlab-ci.yml` | parsed with a YAML parser; stages, `needs` and `extends` resolved by a script; `glab ci lint` needs a GitLab project and was not run; not executed on GitLab |
| `renovate.json` | `renovate-config-validator --strict` |
| `lefthook.yml`, `commitlint.config.mjs` | `lefthook validate`; commitlint on a valid and an invalid message. The `secrets` job was run without the gitleaks binary (its line prints and the commit goes on); its gitleaks command is the one of the pipeline's image, 8.30.1, read from the gitleaks README, not executed here |
| branch protection, merge request settings | written from the API documentation, not executed |
