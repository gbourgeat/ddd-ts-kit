**A study of the velocity of the build, the checks and the tests, with its measures and its plan.**
The proposal page `docs/proposals/build-and-test-velocity.md` (and its French page) measures
where the time and the memory of this repository go, on a workstation and in the pipeline, tests
the levers of Vitest, ESLint, Oxlint, the native compiler and the package managers on this tree,
summarizes what other teams published about orchestrators, package managers, test selection and
GitHub Actions, and ends with a plan in order of gain per cost: fewer jobs per pipeline run and
the heavy families narrowed on a pull request, the compile matrix of five spec files in
parallel, half the cores and `related` tests before a push, the ESLint content cache, the type
check of the specs in parallel; Oxlint and arm64 runners to try; pnpm not now; no orchestrator.
Nothing of the pipeline or of the templates changes in this pull request.
