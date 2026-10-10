# Static analysis and the pipeline

**Summary.** The architecture is held by analyzers, not by review comments. Three of them share
one set of rule ids, each where it is exact: the kit's own checker reads paths, text and the
glossary; the ESLint plugin reads the syntax tree; dependency-cruiser reads the resolved import
graph. knip finds dead code, and the TypeScript compiler in strict mode closes the set. A
generated project carries two TypeScript versions side by side, because the native compiler
(7) has no JavaScript API yet and the lint tools need one. The same gates run on GitHub Actions
and on GitLab CI from the same npm scripts. This page compares the tools, says what was
verified and what was not, and when a lighter setup is enough.

## Why several analyzers

A single rule such as `layer/domain-purity` (see the rule table of the
[architecture reference](../ARCHITECTURE.md)) can be broken in ways that different tools see:

- a direct `import { z } from 'zod'` in an aggregate: any of the three sees it;
- the same import hidden in a string or a comment: a text reader may report it wrongly, a
  syntax tree does not;
- a type that reaches the domain through a barrel of an allowed folder: only a tool that
  resolves modules sees it.

So the cheapest tool runs most often and the most exact one has the last word.

## Comparison

Versions and licences were read from npm on 2026-10-10.

| | `ddd-ts-kit check` | `@ddd-ts-kit/eslint-plugin` | dependency-cruiser | knip | TypeScript (strict) |
|---|---|---|---|---|---|
| Reads | paths, text through a small lexer, `CONTEXT.md`, the config | the syntax tree of one file, types when asked | the resolved module graph | the project's entry points and exports | the whole program |
| Authority for | the tree, names, the glossary, the config, required specs and builders, the generated barrel, unique consumer and job names | code rules: layers, context imports, purity, clean code, aggregate and handler shape, ports, declarations | the same boundaries through barrels and re-exports, cycles, orphans, undeclared dependencies | unused files, exports, types, dependencies | types |
| Dependencies | none | ESLint 9 or 10, typescript-eslint, `@stylistic/eslint-plugin` | dependency-cruiser 18.5.0 (MIT), a TypeScript parser | knip 6.41.0 (ISC) | the compiler |
| Runs | after each file write (editor hook), on staged files, in CI | on staged files, in CI | in CI | in CI | pre-push, in CI |
| Cost on the sample project of the pipeline README (three contexts, 87 files) | 0.3 s | 4.5 s with types | 0.8 s | 0.6 s | 0.4 s with the native compiler |
| Blind spots | no compiler: barrels and re-exports not resolved, arrow functions not judged for some rules, heuristics on comments | one file at a time: nothing about the project as a whole | says nothing about what a file does, only what it imports | needs correct entry points; discovered files must be declared as entries | does not know the architecture |

Other tools exist for parts of this job (import-boundary ESLint plugins, monorepo boundary
rules, other dead-code finders). None was evaluated for this page. The kit's configuration for
dependency-cruiser is generated from `ddd-ts-kit.config.json`, which is what makes it follow
the context map without hand editing.

## Selection criteria

- **Feedback time.** A rule that answers in under a second can run at every write. One that
  needs types cannot. Keep both, in that order.
- **Exactness.** When two tools disagree on a code rule, the syntax tree wins: the ESLint
  plugin README says the checker is then the one to fix.
- **What must be judged project-wide.** A missing spec, a stale barrel, a name absent from the
  glossary or a cycle in the context map are not facts of one file.
- **Cost of a false positive.** A heuristic rule (noise comments, commented-out code) defaults
  to a warning; structural rules default to errors.

## TypeScript 6 and 7 side by side

TypeScript 7 is the native compiler. It compiles and type-checks much faster, and as released
it ships no JavaScript API. Tools that load the compiler as a library cannot run on it.

What was found on 2026-10-10:

- `typescript` on npm is 7.0.2;
- `typescript-eslint` 8.71.1 declares the peer range `typescript >=4.8.4 <6.1.0`, so it does
  not accept TypeScript 7;
- articles on the 7.0 release report that a new programmatic API is expected in a later 7.x
  release. Whether and when typescript-eslint will support it could not be verified from an
  official statement of that project.

The kit's answer, as its READMEs state: a generated project installs both. `typescript` 6
serves the tools that read sources through the compiler API (ESLint with types,
dependency-cruiser), and `@typescript/native`, an npm alias of `typescript` 7, compiles and
type-checks, called by its path because both packages declare a `tsc` binary and `npx tsc`
would pick one of them. With `typescript` 7 alone, ESLint with types does not start, and the
dependency-cruiser configuration falls back to `@swc/core` when it is installed (it then
follows type-only imports without telling them apart) and fails loudly otherwise.

The cost is two compilers to keep compatible: a syntax accepted by 7 and not by 6 would
type-check and then fail to lint. Renovate or Dependabot will propose bumping `typescript`
itself to 7; refuse it until the lint tools accept it.

## GitHub Actions and GitLab CI

The rule of the pipeline directory: CI logic lives in npm scripts, and the two platform files
only orchestrate. Every gate therefore runs on a laptop with the same command.

| Piece | GitHub Actions | GitLab CI |
|---|---|---|
| Triggers | pushes to the default branch and pull requests | merge requests and the default branch |
| Redundant runs | cancelled by concurrency groups | cancelled by interruptible jobs |
| Gates | the same `ci:*` scripts | the same `ci:*` scripts |
| Lint and architecture findings | annotations on the pull request | Code Quality reports |
| Test reports | the Vitest reporter for Actions, coverage as an artifact | JUnit and Cobertura reports in the merge request |
| Secrets scan | gitleaks | gitleaks |
| Image build without push | the Docker build action | BuildKit rootless |
| Title check | commitlint on the pull request title | commitlint on the merge request title |
| What makes it binding | one `gate` job as the required check | "pipelines must succeed" |
| Dependency updates | Renovate or Dependabot | Renovate |

Differences that depend on the plan, as the pipeline README lists them: CodeQL and dependency
review are free on public GitHub repositories and need GitHub Code Security on private ones;
GitLab's SAST and Secret Detection templates run on every tier but show findings in the merge
request only on Ultimate, Dependency Scanning is Ultimate only, and push rules for commit
messages need Premium or Ultimate. On both platforms the two checks that block on every plan
are `npm audit` and gitleaks. The tier statements are those of the pipeline README; they were
not re-checked against the vendors' current pricing pages for this page.

Selection between the two is rarely a free choice: it follows where the code is hosted. The
point of the design is that the choice costs nothing in the gates themselves.

## What this kit supports and verified

From [`pipeline/README.md`](../../pipeline/README.md), the
[CLI README](../../packages/cli/README.md) and the
[ESLint plugin README](../../packages/eslint-plugin/README.md):

- **Checker.** No runtime dependency. Each violation has a rule id, a severity, a location and
  a `fix` sentence; `explain <rule-id>` gives the reason with a bad and a good example. Output
  formats for people, JSON, GitHub annotations and GitLab Code Quality. A generation test
  produces every kind for every stack and requires zero violation, so generator and checker
  cannot disagree.
- **ESLint plugin.** Flat config only, ESLint 9 and 10. A preset function returns a complete
  configuration with typescript-eslint strict and type-checked rules; standard rules are
  enabled where they fully cover a convention, and ten strict rules are adjusted, each for a
  stated reason. Run on a generated project clean and with one deliberate violation per rule.
- **dependency-cruiser.** Configuration derived from the project config; run with version 18
  with the TypeScript 6 parser and with `@swc/core`, every rule reporting its deliberate
  violation.
- **knip.** Unused file, export, type and dependency reported on the sample project.
- **Hooks.** lefthook: ESLint and the checker on staged files before a commit, type check and
  unit tests before a push, commitlint on the message.
- **Coverage thresholds per layer**, highest for `domain/`, lowest for `infrastructure/`.
- **Drift gates.** The context map, the generated lists of each `CONTEXT.md`, the OpenAPI
  document, the AsyncAPI document and the event catalog are regenerated and compared.

**Not executed, by the pipeline README's own account:** the GitHub workflows were parsed and
checked with actionlint, not run on GitHub; the GitLab file was parsed and its stages resolved
by a script, `glab ci lint` was not run, and it was not executed on GitLab; branch protection
and merge request settings were written from the API documentation.

**Mutation testing is not shipped.** The pipeline README reports that Stryker 10, run on the
domain layer of a generated project with Vitest 5, executed no test per mutant and reported
every mutant as survived, and that its core rewrites the tsconfig through an API the native
compiler lacks. It will be added as a scheduled job when the runner supports Vitest 5. (On
npm, `@stryker-mutator/vitest-runner` 10.0.0 declares the peer `vitest >=2.0.0`, checked on
2026-10-10; the behaviour itself was not re-run for this page.)

## Limits and when not to use it

- **The checker is a text reader.** Its README lists what it misses: re-exports and barrels,
  `.tsx`, arrow functions for the stepdown and size rules, aliased imports for several rules,
  a schema name in raw SQL, a cross-context transaction. It is the fast net, not the proof.
- **The ESLint plugin judges one file.** It cannot know that a spec is missing or that two
  consumers share a name.
- **Nothing constrains what `shared-kernel/`, `platform/` and `main.ts` import** in the
  checker. Review those by hand.
- **Analyzers check shape, not design.** An anemic aggregate with private setters renamed as
  methods passes every rule. The `architecture-reviewer` agent and human review exist for that.
- **A fresh scaffold can be reported**: a port or a fake generated before anything uses it is
  an unused file for knip and an orphan for dependency-cruiser, per the pipeline README.
  Generate it with the use case that needs it.
- **Typed lint is the slowest static gate** (seconds, not milliseconds). Without types the
  preset is faster and loses the rules that read types.
- **When a lighter setup is enough:** a prototype or a script with no bounded context gains
  little from the structural rules. The checker has a mode that runs only the clean code rules
  on any directory, without a project or a config.
- **Relaxing a rule is a recorded decision**, not a local edit: see
  `governance/recorded-deviation`.

## Recommendation by situation

| Situation | Choice |
|---|---|
| A project generated by `init` | keep everything as generated; mark the single gate job as required |
| Adopting the kit in an existing codebase | start with the checker and the ESLint preset at `warn` where the legacy fails, each relaxation recorded with its decision record; add dependency-cruiser when the tree is in place |
| The editor loop of a coding agent | the per-file check after each write, the full gate before finishing |
| A monorepo with its own boundary tooling | keep it for package boundaries; the kit's rules still hold inside each service |
| TypeScript 7 only, no TypeScript 6 | not possible today with typed lint; keep both |
| GitLab on a free tier | the pipeline as generated: audit and gitleaks block; scanner findings are visible in the job logs only |
| Wanting mutation testing now | run it by hand on TypeScript 6 and an older Vitest in a side branch, knowing the kit does not support it |

## Sources

- This repository: `pipeline/README.md`, `packages/cli/README.md` (sections `check`, "Limits"),
  `packages/eslint-plugin/README.md`, `docs/ARCHITECTURE.md` ("Who checks what").
- typescript-eslint: https://typescript-eslint.io ; peer range read with
  `npm view typescript-eslint peerDependencies`.
- TypeScript 7.0 announcement: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- ESLint flat config: https://eslint.org/docs/latest/use/configure/configuration-files
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser
- knip: https://knip.dev
- GitHub Actions: https://docs.github.com/actions ; GitLab CI/CD: https://docs.gitlab.com/ci/
- gitleaks: https://github.com/gitleaks/gitleaks ; lefthook: https://github.com/evilmartians/lefthook ;
  commitlint: https://commitlint.js.org
- Stryker: https://stryker-mutator.io
- Robert C. Martin, Clean Architecture, Prentice Hall, 2017 (the dependency rule the analyzers
  enforce).

## See also

- [Layers and the dependency rule](../concepts/layers-and-dependency-rule.md)
- [Clean code](../concepts/clean-code.md)
- [Test runners](test-runners.md)
- [Commit discipline](../guides/commit-discipline.md)
- [Team workflow](../guides/team-workflow.md)
- [Configuration](../CONFIG.md): `rules`, `limits`, `deviations`, `guard`
