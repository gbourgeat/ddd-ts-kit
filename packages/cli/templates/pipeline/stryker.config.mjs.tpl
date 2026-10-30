import { governedMutation } from '@ddd-ts-kit/testing/mutation';

export default {
  {{#if tests.vitest}}
  testRunner: 'vitest',
  // Named, since Stryker looks for its plugins beside its own real path, where pnpm's strict layout keeps `core` alone; the ignorer of the kit is appended by governedMutation().
  plugins: ['@stryker-mutator/vitest-runner'],
  // The unit specs alone: a mutant of the domain or of the application is noticed by a spec of the domain or of the application, in milliseconds.
  vitest: { configFile: 'vitest.mutation.config.ts' },
  {{/if}}
  {{#if tests.jest}}
  testRunner: 'jest',
  // Named, since Stryker looks for its plugins beside its own real path, where pnpm's strict layout keeps `core` alone; the ignorer of the kit is appended by governedMutation().
  plugins: ['@stryker-mutator/jest-runner'],
  // The specs are ES modules and run under the flag the "test" script passes to Jest: Stryker passes it to the processes it runs Jest in.
  testRunnerNodeArgs: ['--experimental-vm-modules'],
  // The unit specs alone: a mutant of the domain or of the application is noticed by a spec of the domain or of the application, in milliseconds; Jest runs the specs that import the mutated file.
  jest: { projectType: 'custom', configFile: 'jest.mutation.config.js', enableFindRelatedTests: true },
  {{/if}}
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
