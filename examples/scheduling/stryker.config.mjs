import { governedMutation } from '@ddd-ts-kit/testing/mutation';

export default {
  testRunner: 'vitest',
  // The unit specs alone: a mutant of the domain is noticed by a spec of the domain or of the application, in milliseconds.
  vitest: { configFile: 'vitest.mutation.config.ts' },
  // The compiler is not asked to check each mutant: a mutant the types refuse is one the tests refuse too, for less.
  checkers: [],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'json', 'html'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  tempDirName: '.stryker-tmp',
  // What is mutated, what is left out and the floor come from "mutation" in ddd-ts-kit.config.json, the reference when it is absent: the floor is written nowhere else.
  ...governedMutation(),
};
