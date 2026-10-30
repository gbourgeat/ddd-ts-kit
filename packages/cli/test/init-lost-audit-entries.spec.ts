import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { initProject } from './support/init-project';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);

const COMMANDS = /commands: auditMiddleware\(trail, \{ \.\.\.source, unitOfWork, onLostRecord \}\)/;
const QUERIES = /queries: auditMiddleware\(trail, \{[^}]*onLostRecord \}\)/;
const ERASURE_SOURCE = /const source = \{[^}]*onLostRecord \};/;

describe('a failure whose audit entry could not be written, in a generated project', () => {
  it('is told to the log by the middlewares, with tsyringe and by hand', () => {
    for (const root of [initProject(), initProject('--di', 'manual', '--orm', 'knex')]) {
      const audit = platform(root, 'audit/create-audit.ts');

      expect(audit).toContain('const onLostRecord = logLostRecords(logger);');
      expect(audit).toMatch(COMMANDS);
      expect(audit).toMatch(QUERIES);
    }
  });

  it('is told to the log by the export, the purge, the erasure and the keys of the data subjects', () => {
    const resolved = initProject();
    const byHand = initProject('--di', 'manual', '--orm', 'knex', '--event-sourcing', 'on');

    expect(platform(resolved, 'privacy/run-purge.ts')).toContain('logLostRecords(resolve(Logger))');
    expect(platform(resolved, 'privacy/run-export.ts')).toContain('logLostRecords(container.resolve(Logger))');
    expect(platform(resolved, 'privacy/run-erasure.ts')).toContain('logLostRecords(container.resolve(Logger))');
    expect(platform(resolved, 'privacy/run-erasure.ts')).toMatch(ERASURE_SOURCE);
    expect(platform(byHand, 'privacy/run-purge.ts')).toContain('const { trail, onLostRecord } = platform.audit;');
    expect(platform(byHand, 'privacy/run-export.ts')).toContain('const { trail, onLostRecord } = platform.audit;');
    expect(platform(byHand, 'privacy/run-erasure.ts')).toContain('const { trail, onLostRecord } = platform.audit;');
    expect(platform(byHand, 'privacy/run-erasure.ts')).toMatch(ERASURE_SOURCE);
    expect(platform(byHand, 'event-sourcing/create-event-sourcing.ts')).toContain('onLostRecord: audit.onLostRecord');
  });

  it('reaches the scripts of the privacy requests, which log errors alone', () => {
    const audited = initProject();
    const unaudited = initProject('--audit', 'off');

    for (const script of ['privacy-erase', 'privacy-export', 'privacy-purge']) {
      expect(read(audited, `scripts/${script}.ts`)).toContain(`service: '${script}'`);
      expect(read(audited, `scripts/${script}.ts`)).toContain("level: 'error'");
      expect(read(unaudited, `scripts/${script}.ts`)).not.toContain(`service: '${script}'`);
    }
  });
});
