import type { Rule } from '../model/rule';
import { strykerSettings } from '../mutation/stryker-settings';
import { reporter } from '../support/reporter';

export const testMutationGoverned: Rule = {
  id: 'test/mutation-governed',
  description:
    'The mutation score cannot be gamed by configuration: the Stryker config reads what it mutates, what it leaves out and the floor from ddd-ts-kit.config.json through governedMutation, and writes no mutate, mutator, ignorers, ignoreStatic, incremental, force or thresholds by hand.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);

    return strykerSettings(project).map(({ file, line, message, fix }) => report({ file, line }, message, fix));
  },
};
