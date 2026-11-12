import fs from 'node:fs';
import path from 'node:path';
import { type Files, mergeWith } from './merge-repository';
import { commitFiles, onBranch, trunkRepository } from './trunk-history';

/** A project of `orm` whose branch added `ours`, whose trunk added `theirs`, and which merged the trunk with git alone. */
export function mergedByGit(
  orm: 'knex' | 'prisma' | 'typeorm',
  { ours, theirs }: { ours: Files; theirs: Files },
): string {
  const root = trunkRepository({ 'ddd-ts-kit.config.json': JSON.stringify({ contexts: {}, stack: { orm } }) });

  onBranch(root, 'build/billing');
  commitFiles(root, ours, 'feat(billing): issue an invoice');
  onBranch(root, 'main');
  commitFiles(root, theirs, 'feat(payments): record a payment (#2)');
  onBranch(root, 'build/billing');
  mergeWith(root, {});

  return root;
}

/** The entries of a migrations folder, its `meta/` aside, sorted. */
export function names(root: string, folder = 'migrations'): string[] {
  return fs
    .readdirSync(path.join(root, folder))
    .filter((entry) => entry !== 'meta')
    .sort();
}

/** What the trunk gained meanwhile: one migration, after which those of the branch have to sort. */
export const PAYMENTS = {
  'migrations/20261016090000_add-payments.js': "export const up = (knex) => knex.schema.createTable('payments');\n",
};
