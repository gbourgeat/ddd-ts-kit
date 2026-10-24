**Six rules of `@ddd-ts-kit/eslint-plugin` hold the shape of a test.** The testing skill asked
for it and nothing checked it: a test is named after the rule it proves, holds no logic, asserts an
outcome, asserts a refusal by its code, never by a snapshot, and every test runs. Each is a rule
of the architecture reference now, on every test file of the project (`*.spec.ts`, `*.test.ts`,
the `test/` of a context), read by ESLint alone: `test/no-only-no-skip` (no `.only`, `.skip`, `fit`,
`xit`, `xdescribe`, no `.skipIf` or `.runIf` on a constant), `test/title-states-a-rule` (the title of an `it`
in lower case, what the subject does, after the rows and the criterion it cites, never `should`,
`test`, `works` nor a method or a class; a `describe` named after the unit),
`test/no-logic` (no `if`, `switch`, ternary, loop or `try` in a test), `test/assertion-present`
(an `expect`, an `expect...` or `assert...` helper, or `thenEvents`, `thenError`, `thenState` in
every test; `it('title')` without a body written `it.todo`), `test/refusal-by-code` (`toThrow`
with a message, a regular expression, a class or nothing reported in the specs of the model and of
the application, not in those of the adapters and of the platform; `thenError`, `expectRefusal`,
`rejects.toMatchObject({ code })` and `expectProblem` instead, and `rejects.toBe(outage)` for a
failure the test injected) and
`test/no-snapshot`. `ddd-ts-kit rules` lists them as checked by the plugin, `ddd-ts-kit explain`
explains each, the config sets their severity under `rules`. The `it.todo` left in a spec was
already a marker `ddd-ts-kit todo` lists and `story --gate close` refuses while it belongs to the
story: the testing strategy and the skill now say so. The example application and the templates
follow the six rules; the rules of the agents on tests (`.claude/rules/tests.md`,
`.github/instructions/tests.instructions.md`) name them.

To move: run `npm run lint`. `test/no-only-no-skip` and `test/no-snapshot` are errors, as nothing
legitimate trips them; the four rules that read what a test says, `test/title-states-a-rule`,
`test/no-logic`, `test/assertion-present` and `test/refusal-by-code`, are warnings until 0.90.0,
listed by `ddd-ts-kit lint` after its report without failing it. Rename a title that says
`should` or names a method, move a loop to an `it.each` and a decision to a builder or a fake,
replace a `toThrow('message')` by the code of the refusal, and write `it.todo` where a test has
no body. A project that wants none of a rule sets it to `off` under `rules` of
`ddd-ts-kit.config.json`.
