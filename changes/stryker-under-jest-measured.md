**The test runners page says how mutation testing fares under each runner.** On the identity
preset, Stryker completes under Vitest in 1 min 46 s with 19 processes and 1 min 54 s with 8, for
11.6 GB and 5.4 GB of summed memory; under Jest it did not complete on a workstation of 31 GB, at
19 or 8 processes nor with each process restarted after 10 runs, each Jest process reaching about
2.5 GB within the first minute. `docs/tools/test-runners.md` gives the figures, a recommendation
(`--concurrency 8` under Vitest on a workstation, the mutation job planned on Vitest) and a limit
of Jest.
