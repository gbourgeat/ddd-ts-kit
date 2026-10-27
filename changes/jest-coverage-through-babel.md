**A Jest project measures its coverage through the `babel` provider.** The `jest.config.js` that
`init --tests jest` writes sets `coverageProvider: 'babel'` instead of `'v8'`: on the scheduling
example ported to Jest, a run with coverage takes 20.6 s instead of 48.0 s on a workstation, and
65 s instead of 201 s on four CPUs, faster than the same specs under Vitest (measured in
`docs/tools/test-runners.md`). The branches it reports are those of the `v8` provider of Vitest;
the `v8` provider of Jest reported two to three points more. A line left out of the measure carries
the hint the provider reads, `istanbul ignore`, which `v8` did not read, as `babel` does not read
`v8 ignore`: the explanation of `test/coverage-governed` (`ddd-ts-kit explain`) gives both, and
the testing rules of a new project name the one its runner reads.

To move: in the `jest.config.js` of an existing Jest project, set `coverageProvider: 'babel'`,
rewrite each `v8 ignore` comment as `istanbul ignore` with its decision record, and run
`npm run test:coverage` once: a layer whose branch threshold sat within three points of the old
figure can fall under it.
