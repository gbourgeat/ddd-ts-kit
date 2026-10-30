import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { initProject } from './support/init-project';

const erasure = (root: string): string => read(root, 'src/platform/privacy/run-erasure.ts');

const BY_HAND = ['--di', 'manual', '--orm', 'knex'];
const NO_OUTBOX = ['--events', 'in-memory', '--allow-no-outbox', 'One process, one database.'];
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

describe('what an erasure reaches beyond the copies of the contexts', () => {
  it('erases the records of the outbox and the jobs of the person, once, in both families', () => {
    const tsyringe = erasure(initProject());
    const byHand = erasure(initProject(...BY_HAND));

    expect(tsyringe).toContain('shared: platformCopies(container).map(audited),');
    expect(tsyringe).toContain('personalEventsInOutbox(container.resolve(OutboxStore), personalEvents);');
    expect(tsyringe).toContain('jobsOfSubject(container.resolve(JobStore));');

    expect(byHand).toContain('shared: platformCopies(platform).map(audited),');
    expect(byHand).toContain('personalEventsInOutbox(platform.persistence.outbox, personalEvents);');
    expect(byHand).toContain('jobsOfSubject(platform.jobStore);');
  });

  it('leaves the jobs alone when they stay in the memory of a process the script does not share', () => {
    const memory = initProject('--queue', 'memory');

    expect(erasure(memory)).toContain('personalEventsInOutbox(');
    expect(erasure(memory)).not.toContain('jobsOfSubject');
    expect(exists(memory, 'src/platform/privacy/personal-events.ts')).toBe(true);
  });

  it('reaches no outbox when the events leave no record, and no platform copy at all when nothing is stored', () => {
    const direct = initProject(...NO_OUTBOX);
    const nothing = initProject(...NO_OUTBOX, '--queue', 'memory');

    expect(erasure(direct)).not.toContain('personalEventsInOutbox');
    expect(erasure(direct)).toContain('jobsOfSubject(container.resolve(JobStore));');
    expect(exists(direct, 'src/platform/privacy/personal-events.ts')).toBe(false);

    expect(erasure(nothing)).not.toContain('platformCopies');
  });

  it('opens the Redis server the jobs wait on, so that the script reaches them', () => {
    const script = read(initProject('--cache', 'redis', '--queue', 'redis'), 'scripts/privacy-erase.ts');

    expect(script).toContain('const redis = openRedis(loadConfig(process.env));');
    expect(script).toContain('  redis,\n});');
    expect(script).toContain('await redis.close();');
  });
});
