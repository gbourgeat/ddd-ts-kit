**Mutation testing of the domain layer runs every night, each context held to a floor.** `init`
writes `stryker.config.mjs`, which spreads `governedMutation()` of `@ddd-ts-kit/testing/mutation`:
the domain layer of every context mutated, at its level and in the modules of its model, the
texts of refusals left out by an ignorer the kit ships, since a refusal is asserted by its code and
never by its text, every other string measured, the static mutants ignored, those of code that runs
once when the module loads, the floor as
`thresholds`; and `vitest.mutation.config.ts`, the unit specs alone. `npm run test:mutation` runs
Stryker, then `ddd-ts-kit mutation`, a new command that reads `reports/mutation/mutation.json` and
holds the domain of each context to the `mutation` floor of `ddd-ts-kit.config.json`, 80 by the
reference (a lower floor is a recorded deviation, `"what": "mutation.domain"`), and exits 1 under
it; the ignored mutants of each context are shown beside its score, since a rule written as a
declaration is never mutated and its test is its only proof. The pipelines of GitHub and GitLab get a
`mutation` job that runs it when the schedule fires, never on a pull or merge request, and keeps
the report as an artifact. A new rule, `test/mutation-governed`, refuses a `mutate`,
`mutator`, `ignorers`, `ignoreStatic` or `thresholds` written by hand in a Stryker config, and a
Stryker config that does not read the kit. The example application and the pipeline of the kit run
the same job. On both runners: a project on Jest gets `jest.mutation.config.js` in place of the
Vitest one, and its Stryker config passes the ES modules flag to the processes that run the specs.

To move: `npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner` (`jest-runner` on Jest),
copy `stryker.config.mjs` and `vitest.mutation.config.ts` or `jest.mutation.config.js` from a
freshly initialised project (or run `init --force` on a copy and take the two files and the
`test:mutation` script), add the
`mutation` job to your pipeline from `pipeline/github/workflows/ci.yml` or
`pipeline/gitlab/.gitlab-ci.yml`, list `vitest.mutation.config.ts` under `vitest.config` of
`knip.json`, and add `.stryker-tmp/` and `/reports/mutation/` to `.gitignore`. Run
`npm run test:mutation` once: a context under 80 names the rules its tests do not state.
