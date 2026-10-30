import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { initProject } from './support/init-project';

const erasure = (root: string): string => read(root, 'src/platform/privacy/run-erasure.ts');

const BY_HAND = ['--di', 'manual', '--orm', 'knex'];
const EVENT_SOURCED = ['--event-sourcing', 'on'];

describe('what an erasure leaves in the audit trail', () => {
  it.each([
    ['tsyringe, rows', [], 'copies: dataSubjectCopies.map((copy) => audited(container.resolve(copy))),'],
    ['tsyringe, events', EVENT_SOURCED, 'copies: dataSubjectCopies.map((copy) => audited(container.resolve(copy))),'],
    ['by hand, rows', BY_HAND, 'copies: dataSubjectCopies.map((copy) => audited(copy(platform))),'],
    [
      'by hand, events',
      [...BY_HAND, ...EVENT_SOURCED],
      'copies: dataSubjectCopies.map((copy) => audited(copy(platform))),',
    ],
  ])(
    'leaves the entry of every copy in the audit trail with its operator, whatever seals what (%s)',
    (_, flags, line) => {
      const written = erasure(initProject(...flags));

      expect(written).toContain('auditedPersonalDataErasure');
      expect(written).toContain(line);
      expect(written).toContain('actor: operatorActor(operator)');
    },
  );

  it('writes no entry when the trail is off', () => {
    const tsyringe = erasure(initProject('--audit', 'off'));
    const byHand = erasure(initProject('--audit', 'off', ...BY_HAND));

    expect(tsyringe).not.toContain('audit');
    expect(byHand).not.toContain('audit');
    expect(tsyringe).toContain('copies: dataSubjectCopies.map((copy) => container.resolve(copy)),');
    expect(byHand).toContain('copies: dataSubjectCopies.map((copy) => copy(platform)),');
  });
});
