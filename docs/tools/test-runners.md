# Test runners: Vitest and Jest

**Summary.** The testing approach of the kit (fakes instead of mocks, builders, contract
suites, four test levels) does not depend on a runner: the helpers import none, and the
contract suites take the runner's functions as an argument. A runner still has to be chosen.
Vitest is the default and the one the kit's own pipeline, coverage thresholds and end-to-end
proofs are built on. Jest is supported by the generator with a narrower setup. This page
compares the two for this kind of project and states exactly what each choice gives you.

## What the runner has to do here

A context of the scheduling application has specs at several levels (see the
[testing strategy](../concepts/testing-strategy.md) and section 7 of the
[architecture reference](../ARCHITECTURE.md)):

- `Appointment` refuses a second cancellation: a pure domain spec, milliseconds;
- `CancelAppointment` through the in-memory command bus with fakes: milliseconds;
- the appointment repository against PostgreSQL, held to the repository contract: seconds;
- `POST /appointments` end to end over HTTP and the event bus: seconds.

So the runner must run TypeScript written as ES modules, handle decorators (the declared style
puts one on handlers and adapters), split fast and slow specs, and measure coverage per layer.
It does not need a mocking system: `test/no-mocks` discourages one.

## Comparison

Versions and licences were read from npm on 2026-10-10.

| | Vitest | Jest |
|---|---|---|
| Version, licence | 5.0.3, MIT | 30.5.2, MIT |
| TypeScript | supported out of the box, through Vite's transformers | needs a transformer (`babel-jest` with your Babel configuration by default): the kit's template uses `@swc/jest` |
| ES modules | "ESM first" in its own words | experimental in Jest's own words, through Node's `--experimental-vm-modules` flag, which the generated scripts pass |
| Decorators | lowers legacy decorators itself and not standard (TC39) ones, which need the kit's plugin (as the testing README states and the kit's suites exercise; not found on vitest.dev) | whatever the transformer does: the kit's template configures legacy decorators with metadata |
| Projects (unit and integration apart) | yes, used by the kit | yes as a Jest feature (`projects`); not used by the kit's template |
| Coverage | `v8`, `istanbul` or a custom provider; thresholds per glob pattern, used by the kit | `babel` (default) or `v8` provider; `coverageThreshold` global, per glob or per path; no threshold in the kit's template |
| Watch mode | reruns the tests related to a change by searching the module graph | `--watch` reruns the tests related to changed files, which needs a git or hg repository and a static dependency graph; `--watchAll` reruns everything |
| Globals | imported from `vitest` | imported from `@jest/globals` in generated specs |
| Ecosystem (a judgement, not a measured fact) | newer, aligned with Vite | older, many existing suites |

The feature rows were read on 2026-10-10 from the documentation of Vitest 5.0.3
(https://vitest.dev/guide/features , https://vitest.dev/config/coverage) and of Jest 30.5
(https://jestjs.io/docs/configuration , https://jestjs.io/docs/ecmascript-modules ,
https://jestjs.io/docs/cli). The decorator row for Vitest and the ecosystem row are not from
those pages and are marked as such.

Type checking is done by neither: both strip types. The compiler does it in its own gate.

Speed comparisons between the two depend on the project and were not measured for this page.

## Selection criteria

- **What the kit proves.** The stacks the CLI generates, runs and lints end to end in its own
  test suite are Vitest projects. With Jest you leave that verified path (details below).
- **Existing suites.** An organisation with thousands of Jest specs, shared presets and
  trained people has a real reason to stay on Jest.
- **Decorator mode of the project.** With class-validator or NestJS the project is in the
  legacy decorator mode and both runners handle it. In the standard mode, Vitest needs one
  plugin line and the Jest template would need its transformer options changed.
- **Coverage gates per layer.** Provided for Vitest; to be written for Jest.
- **Framework habits.** NestJS documentation and generators assume Jest; that is a habit, not
  a constraint, since handlers and aggregates of the kit are tested without the framework.

## What this kit supports and verified

**Runner-agnostic parts** ([`@ddd-ts-kit/testing`](../../packages/testing/README.md)):

- builders, given/when/then scenarios, `createTestBuses` and `InMemoryRepository` import no
  runner and no library;
- the contract suites (`repositoryContract`, `eventBusContract`, `outboxStoreContract`,
  `processedEventStoreContract`, `cacheContract`, `lockContract`, `rateLimiterContract`,
  `jobSchedulerContract`, `loggerContract`) take `{ describe, it, expect, beforeEach }` from
  the caller and use only `toBe` and `toEqual`, "which the globals of vitest and jest both
  provide", in the README's words;
- the rule against mocks names the `vi.*` and the `jest.*` functions alike.

**With Vitest (the default):**

- `vitest.config.ts` with `unit` and `integration` projects and coverage thresholds per layer
  (domain highest, infrastructure lowest, the latter measured by the integration run);
- a separate end-to-end configuration that starts the whole application on a free port, on an
  in-process PostgreSQL unless a database URL is given;
- JUnit and Cobertura reports for GitLab, the Actions reporter for GitHub;
- `decorators()` of `@ddd-ts-kit/testing/vitest` for projects in the standard decorator mode:
  Vitest 5 does not lower standard decorators, and a spec importing a decorated file would
  stop on a syntax error. The plugin compiles only the files holding a decorator with the
  compiler of the project (the native TypeScript 7 included, since it runs the binary), caches
  the result (about 60 ms per file the first time with TypeScript 7, 220 ms with TypeScript 6,
  nothing after, as measured in the README), keeps source maps, and steps aside in the legacy
  mode. It does not type-check and does not touch `.tsx`;
- the generated projects that the CLI proves in full (specs, end-to-end specs, build,
  documentation checks, lint, import graph, dead code) are listed in the CLI README; none of
  them is described there as a Jest project.

**With Jest (`init --tests jest`).** What follows was read in a project generated on
2026-10-10:

- a `jest.config.js` using `@swc/jest`, with decorators parsed in the legacy mode with
  metadata, ES module handling and the import alias mapped;
- a `jest.e2e.config.js` extending it, with a longer timeout and one worker;
- `jest`, `@jest/globals`, `@swc/core` and `@swc/jest` as development dependencies; generated
  specs import their globals from `@jest/globals`;
- one test script for unit and adapter specs together, run with
  `node --experimental-vm-modules`: the integration script of the pipeline only prints that
  adapter specs run with the unit specs;
- no coverage threshold in the generated configuration;
- unit tests of the CLI check that these files and the recorded stack are produced. No
  evidence was found that a generated Jest project is installed and run by the kit's own
  end-to-end suite.

## Limits and when not to use it

**Vitest**

- Standard decorators need the plugin; forgetting it gives a syntax error at the first
  decorated import, not a helpful message.
- The plugin calls the project's compiler once per decorated file on a cold cache: a first run
  in CI without a cache pays it for every such file.
- Tooling around a new major version can lag: the
  pipeline README reports that the mutation testing tool it tried did not work with Vitest 5.

**Jest**

- ES modules rely on `--experimental-vm-modules`. The Node.js documentation (v26.11.1, read
  on 2026-10-10, https://nodejs.org/api/vm.html) labels `vm.Module`, `vm.SourceTextModule` and
  `vm.SyntheticModule` "Stability: 1 - Experimental", and Jest's own page calls its ESM
  support experimental; mocking a module in ESM goes through `jest.unstable_mockModule`.
- `@swc/jest` was last published in September 2025 (0.2.39 on npm); it works with current
  Jest as far as the template assumes, which was not run for this page.
- The template compiles decorators in the legacy mode whatever the project's `tsconfig.json`
  says. The declarations of the kit work in both modes, so this is harmless for them; a
  library that needs standard decorators would not be served.
- No unit and integration split, no thresholds, no in-repository proof of a full run: those
  are yours to add and to keep working.

**Either one**

- A runner does not make a test good. A spec that asserts calls instead of outcomes is as
  brittle under Vitest as under Jest.
- Do not mix both runners in one project: two configurations, two transform pipelines and two
  sets of globals for no gain.

## Recommendation by situation

| Situation | Choice |
|---|---|
| New project | Vitest: the default, the verified path, thresholds and reports included |
| Declared style in the standard decorator mode | Vitest with the `decorators()` plugin |
| NestJS or class-validator project (legacy decorators) | Vitest works without the plugin; Jest if the team's NestJS tooling is built on it |
| Existing codebase with a large Jest suite adopting the kit | Jest, adding the project split and thresholds by hand; plan a migration only if it pays |
| A library or adapter published for others | write its contract with `ContractSuite`, so consumers run it under either runner |
| Wanting mutation testing | not available in the kit today, with either runner |

## Sources

- This repository: `packages/testing/README.md` (contract suites, "Standard decorators under
  Vitest"), `packages/cli/README.md` (`init`, "Development"), `pipeline/README.md` (coverage
  thresholds, reports, mutation testing), `docs/ARCHITECTURE.md` sections 5 and 7; templates
  `packages/cli/templates/init/jest.config.js.tpl` and
  `packages/cli/templates/init/e2e/jest.e2e.config.js.tpl`.
- Vitest: https://vitest.dev/guide/features and https://vitest.dev/config/coverage (v5.0.3, read
  on 2026-10-10); npm: https://www.npmjs.com/package/vitest
- Jest 30.5: https://jestjs.io/docs/configuration , https://jestjs.io/docs/ecmascript-modules
  and https://jestjs.io/docs/cli (read on 2026-10-10); npm: https://www.npmjs.com/package/jest
- Node.js, `vm` module (stability of VM modules): https://nodejs.org/api/vm.html
- `@swc/jest`: https://www.npmjs.com/package/@swc/jest
- TC39 decorators proposal: https://github.com/tc39/proposal-decorators
- Martin Fowler, "Mocks Aren't Stubs", martinfowler.com.
- Steve Freeman and Nat Pryce, Growing Object-Oriented Software, Guided by Tests,
  Addison-Wesley, 2009.

## See also

- [Testing strategy](../concepts/testing-strategy.md)
- [Static analysis and pipeline](static-analysis-and-pipeline.md)
- [Ports and composition](../concepts/ports-and-composition.md): decorator modes
- [Dependency injection](dependency-injection.md)
- [Configuration](../CONFIG.md): `stack.tests`
