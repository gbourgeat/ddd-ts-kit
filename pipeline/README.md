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
| `github/workflows/*.yml` | `.github/workflows/` | `ci.yml`, `pr-title.yml` and `copilot-setup-steps.yml` (the environment of the Copilot cloud agent); `codeql.yml` with `--ci-extras codeql` only; `claude-review.yml` and `claude-triage.yml` with `--ci-extras claude-review` and `claude-triage` only. `ci.yml` here is the default: the CLI's template adds the dependency review step under `--ci-extras dependency-review` |
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
| `claude-review.yml`, `claude-triage.yml`, `claude-review.gitlab-ci.yml` | parsed with a YAML parser as the CLI writes them, every shell block checked with `bash -n`; actionlint was not installed on the machine of that change and did not run on them; the inputs of the action were read from its `action.yml` on 2026-10-23 and it is pinned to the commit of v1.0.259; not executed on GitHub or GitLab, and never run against the API |
| `.gitlab-ci.yml` | parsed with a YAML parser; stages, `needs` and `extends` resolved by a script; `glab ci lint` needs a GitLab project and was not run; not executed on GitLab |
| `renovate.json` | `renovate-config-validator --strict` |
| `lefthook.yml`, `commitlint.config.mjs` | `lefthook validate`; commitlint on a valid and an invalid message. The `secrets` job was run without the gitleaks binary (its line prints and the commit goes on); its gitleaks command is the one of the pipeline's image, 8.30.1, read from the gitleaks README, not executed here |
| branch protection, merge request settings | written from the API documentation, not executed |
