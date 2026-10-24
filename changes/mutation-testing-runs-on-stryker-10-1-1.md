**Mutation testing runs on a project of the kit, with Stryker 10.1.1 and its Vitest runner.** The
documentation said it did not: Stryker 10.0 executed no test per mutant under Vitest 5. Measured
on 2026-10-24 on the example application, 10.1.1 runs the tests per mutant and kills 1347 of the
1441 mutants of the domain layer of its four contexts in 8 minutes, a score of 94.5%; the
pipeline README holds the measure, the configuration to run it by hand (no checker, the unit
specs alone, the domain layer as `mutate`) and what shipping it as a scheduled job with a floor
per context would take. The kit ships no gate yet.
