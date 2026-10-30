import { describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { initProject } from './support/init-project';

const ORMS = ['knex', 'drizzle', 'prisma', 'typeorm'] as const;

const WIRINGS = [
  ['tsyringe', ['--di', 'tsyringe']],
  ['manual', ['--di', 'manual']],
  ['nest', ['--http', 'nest', '--di', 'nest', '--routes', 'nest', '--validation', 'class-validator']],
] as const;

const STORES = ['--event-sourcing', 'on', '--queue', 'database'];
const PERSISTENCE = 'src/platform/database/persistence-over.ts';
const BACKGROUND_WORK = 'src/platform/jobs/create-background-work.ts';
const COMPOSITION = 'src/platform/composition/compose-application.ts';

/** What reads the tenants a queue serves: the kernel module on tsyringe, the queue built by the platform otherwise. */
function queueWiring(root: string, di: string): string {
  return di === 'tsyringe' ? read(root, COMPOSITION) : read(root, BACKGROUND_WORK);
}

describe.each(ORMS)('the stores of a project on %s', (orm) => {
  describe.each(WIRINGS)('wired by %s', (di, wiring) => {
    it('refuse work that names no tenant under --tenancy shared-table', () => {
      const root = initProject('--orm', orm, ...wiring, ...STORES, '--tenancy', 'shared-table');

      expect(read(root, PERSISTENCE)).toContain('{ schema: EVENT_STORE_SCHEMA, scope }');
      expect(queueWiring(root, di)).toMatch(di === 'tsyringe' ? /tenants: tenantDirectory\(/ : /tenant: true/);
    });

    it('stay as they are in a project without tenancy', () => {
      const root = initProject('--orm', orm, ...wiring, ...STORES);

      expect(read(root, PERSISTENCE)).not.toContain('{ schema: EVENT_STORE_SCHEMA, scope }');
      expect(queueWiring(root, di)).not.toMatch(/tenant: true|tenants: /);
    });
  });
});

describe('the control plane of the tenants of a multi-tenant project', () => {
  it('keeps its state in tables: an event-sourced aggregate is refused, and says what to do instead', () => {
    const project = initProject(
      ...['--context', 'billing:core', '--orm', 'knex', '--tenancy', 'shared-table', '--event-sourcing', 'on'],
    );

    const config = JSON.parse(read(project, 'ddd-ts-kit.config.json')) as Record<string, unknown>;

    config['contexts'] = { billing: { classification: 'core', upstreams: [], tenancy: 'control-plane' } };
    write(project, 'ddd-ts-kit.config.json', JSON.stringify(config));

    const refused = cli(
      project,
      ...['generate', 'aggregate', 'billing', 'Ledger', '--event-sourced'],
      ...['--term', 'Ledger=Payments', '--term', 'Create=To open'],
    );

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('billing is the control plane of the tenants');
    expect(refused.stderr).toContain('without --event-sourced');
    expect(exists(project, 'src/contexts/billing/domain/aggregates/ledger.aggregate.ts')).toBe(false);
  });
});
