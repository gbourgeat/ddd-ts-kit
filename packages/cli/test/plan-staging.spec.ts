import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { planStaging } from '../src/slice/plan-staging';

const config = parseConfig({
  contexts: { billing: { classification: 'core' }, shipping: { classification: 'supporting' } },
});

const fresh = (path: string): { path: string; tracked: boolean } => ({ path, tracked: false });
const modified = (path: string): { path: string; tracked: boolean } => ({ path, tracked: true });

describe('what a slice stages, by a closed list', () => {
  it('stages the files of its context, an end-to-end spec and the derived files git tracks', () => {
    const plan = planStaging(
      [
        fresh('src/contexts/billing/domain/services/pricing.service.ts'),
        modified('src/contexts/billing/billing.declarations.ts'),
        modified('src/contexts/billing/application/application.declarations.ts'),
        fresh('test/e2e/issue-invoice.e2e.spec.ts'),
        modified('docs/context-map.md'),
        modified('openapi/openapi.yaml'),
        modified('src/contexts/shipping/CONTEXT.md'),
        modified('.dependency-cruiser.cjs'),
      ],
      config,
      'billing',
    );

    expect(plan.leftOut).toEqual([]);
    expect(plan.toStage).toHaveLength(8);
  });

  it('stages the Prisma models of its context with its mapper, never the main schema nor another context', () => {
    const plan = planStaging(
      [
        modified('src/contexts/billing/infrastructure/persistence/invoice.mapper.ts'),
        modified('prisma/schema/billing.prisma'),
        modified('prisma/schema/schema.prisma'),
        modified('prisma/schema/shipping.prisma'),
      ],
      config,
      'billing',
    );

    expect(plan.toStage).toEqual([
      'src/contexts/billing/infrastructure/persistence/invoice.mapper.ts',
      'prisma/schema/billing.prisma',
    ]);

    expect(plan.leftOut).toEqual(['prisma/schema/schema.prisma', 'prisma/schema/shipping.prisma']);
  });

  it('stages the acceptance spec a slice unwraps, never the lock of the story', () => {
    const plan = planStaging(
      [modified('test/acceptance/us5.acceptance.spec.ts'), modified('test/acceptance/us5.acceptance.lock.json')],
      config,
      'billing',
    );

    expect(plan.toStage).toEqual(['test/acceptance/us5.acceptance.spec.ts']);
    expect(plan.leftOut).toEqual(['test/acceptance/us5.acceptance.lock.json']);
  });

  it('leaves out every other path: a private note, an editor folder, another context, the platform, a new file where derived files live', () => {
    const plan = planStaging(
      [
        fresh('Synthèse ddd-ts-kit.md'),
        fresh('.idea/workspace.xml'),
        fresh('src/contexts/shipping/domain/services/routing.service.ts'),
        modified('src/platform/auth/roles/roles.ts'),
        modified('package.json'),
        fresh('openapi/notes.md'),
        fresh('src/contexts/billing-archive/notes.ts'),
        fresh('test/e2e/support/start-application.ts'),
        fresh('.ddd-ts-kit/report.md'),
      ],
      config,
      'billing',
    );

    expect(plan.toStage).toEqual([]);

    expect(plan.leftOut).toEqual([
      'Synthèse ddd-ts-kit.md',
      '.idea/workspace.xml',
      'src/contexts/shipping/domain/services/routing.service.ts',
      'src/platform/auth/roles/roles.ts',
      'package.json',
      'openapi/notes.md',
      'src/contexts/billing-archive/notes.ts',
      'test/e2e/support/start-application.ts',
    ]);
  });

  it('stages a working migration with its snapshot and the journal, and no other migration', () => {
    const plan = planStaging(
      [
        fresh('migrations/0004_working-add-refunds.sql'),
        fresh('migrations/meta/0004_snapshot.json'),
        modified('migrations/meta/_journal.json'),
        fresh('migrations/0005_add-discounts.sql'),
        fresh('migrations/meta/0005_snapshot.json'),
      ],
      config,
      'billing',
    );

    expect(plan.toStage).toEqual([
      'migrations/0004_working-add-refunds.sql',
      'migrations/meta/0004_snapshot.json',
      'migrations/meta/_journal.json',
    ]);

    expect(plan.leftOut).toEqual(['migrations/0005_add-discounts.sql', 'migrations/meta/0005_snapshot.json']);
  });

  it('leaves out the journal when there is no working migration', () => {
    expect(planStaging([modified('migrations/meta/_journal.json')], config, 'billing').leftOut).toEqual([
      'migrations/meta/_journal.json',
    ]);
  });
});
