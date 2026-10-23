import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHANGE_GATED } from '../src/story/change-gated.js';
import { REPO_ROOT } from './helpers.js';

const HOOK_TEMPLATE = path.join(REPO_ROOT, 'packages/cli/templates/init/hooks/change-reference.mjs');

/** The `GATED` literal of the change-reference hook, each regular expression as the hook writes it. */
function gatedOfTheHook(): string[] {
  const text = fs.readFileSync(HOOK_TEMPLATE, 'utf8');
  const literal = text.match(/^const GATED = \[(.*)\];$/m)?.[1] ?? '';

  return [...literal.matchAll(/\/((?:\\\/|[^/])+)\/[a-z]*/g)].map((match) => `/${match[1] ?? ''}/`);
}

describe('the paths story-check reads a change reference for', () => {
  it('are the GATED list of the change-reference hook: the hook asks for the reference of the files story-check reads', () => {
    expect(gatedOfTheHook().length).toBeGreaterThan(0);
    expect(CHANGE_GATED.paths.map((pattern) => pattern.toString())).toEqual(gatedOfTheHook());
  });

  it('match the migrations of every ORM and the containers, and nothing else', () => {
    const gated = [
      'migrations/0001_init.sql',
      'src/platform/database/migrations/0001-working-invoices.ts',
      'prisma/migrations/20261023_init/migration.sql',
      'docker/varnish.vcl',
      'Dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml',
    ];

    const free = [
      'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
      'docs/migrations.md',
      'Dockerfile.dev',
    ];

    expect(gated.filter((file) => !CHANGE_GATED.matches(file))).toEqual([]);
    expect(free.filter((file) => CHANGE_GATED.matches(file))).toEqual([]);
  });
});
