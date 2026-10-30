import { describe, expect, it } from 'vitest';
import { forecastMerge } from '../src/stories/forecast-merge';
import { commitFiles, onBranch, trunkRepository } from './support/trunk-history';

const INVOICE = 'src/contexts/billing/invoice.ts';

describe('the forecast of a merge', () => {
  it('lets through what is no refusal: a failure while settling a path is never a merge it cannot forecast', () => {
    const root = trunkRepository({ [INVOICE]: 'class Invoice {\n}\n' });

    onBranch(root, 'build/billing');
    commitFiles(root, { [INVOICE]: 'class Invoice {\n  pay() {}\n}\n' }, 'feat(billing): pay');
    onBranch(root, 'main');
    commitFiles(root, { [INVOICE]: 'class Invoice {\n  cancel() {}\n}\n' }, 'feat(billing): cancel (#2)');

    const repository = {
      top: root,
      prefix: '',
      modules: {},
      get contextsDir(): string {
        throw new Error('the contexts cannot be read');
      },
    };

    expect(() => forecastMerge(repository, { ours: 'build/billing', theirs: 'main' })).toThrow(
      'the contexts cannot be read',
    );
  });
});
