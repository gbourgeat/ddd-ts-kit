**The test runners page measures Vitest against Jest, and says which settings make each faster.**
`docs/tools/test-runners.md` (and its French page) said speed was not measured; it now gives the
wall time, CPU and memory of both runners on three pairs of projects identical but for `--tests` (a
new project, the identity preset, the scheduling example ported to Jest), cold and warm, with and
without coverage, unit and integration specs apart, one file, and on four CPUs as on a hosted
runner. Without coverage Jest is 24 to 29 percent faster on the larger projects; with coverage as
generated Vitest is 1.6 to 2.4 times faster on the example, the cost of Jest's `v8` provider, while
Jest with the `babel` provider is the fastest of the three (20.6 s against 29.5 and 48.0). The page
also measures the coverage providers and what each one reports, the number of workers, the pool
and isolation of Vitest, the worker threads of Jest, the related specs of a changed file, a
pipeline without cache, the install and mutation testing, and closes on a table of recommendations
by case, each with its measured gain and what to watch. It names two limits of the Jest template
the measures found: coverage through `v8`, and PostgreSQL started in process once per spec file
where the Vitest template starts it once per run.
