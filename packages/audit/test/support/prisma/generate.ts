import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { auditPrismaModels } from '../../../src/prisma/audit-prisma-models';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const generated = fileURLToPath(new URL('../../generated', import.meta.url));

/** Where the DDL of the models lands, as `prisma migrate diff` writes it for a project. */
export const AUDIT_DDL_PATH = `${generated}/ddl.sql`;

/** The schema of a project that keeps its trail in the `audit` schema: the models of the package, nothing else. */
const SCHEMA = `generator client {
  provider            = "prisma-client"
  output              = "./client"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "postgresql"
  schemas  = ["audit"]
}

${auditPrismaModels('audit')}`;

/**
 * Generates the Prisma client of the audit specs and the DDL of the models into `test/generated`
 * (git-ignored) when they are missing or stale: the specs run `npx vitest run` with no manual step.
 */
export async function ensureAuditPrismaClient(): Promise<void> {
  const version: unknown = require('prisma/package.json').version;

  const stamp = createHash('sha256')
    .update(`${String(version)}\n${SCHEMA}`)
    .digest('hex');

  if ((await readFile(`${generated}/stamp`, 'utf8').catch(() => '')) === stamp) {
    return;
  }

  await rm(generated, { recursive: true, force: true });
  await mkdir(generated, { recursive: true });
  await writeFile(`${generated}/schema.prisma`, SCHEMA);

  // `migrate diff` wants a datasource URL even though it never connects for an empty source.
  await writeFile(
    `${generated}/prisma.config.ts`,
    "import { defineConfig } from 'prisma/config';\n\nexport default defineConfig({ schema: './schema.prisma', datasource: { url: 'postgresql://unused:unused@127.0.0.1:1/unused' } });\n",
  );

  await prisma(['generate', '--schema', 'schema.prisma']);
  await prisma(['migrate', 'diff', '--from-empty', '--to-schema', 'schema.prisma', '--script', '-o', 'ddl.sql']);
  await writeFile(`${generated}/stamp`, stamp);
}

async function prisma(args: readonly string[]): Promise<void> {
  await run(process.execPath, [require.resolve('prisma/build/index.js'), ...args], {
    cwd: generated,
    env: { ...process.env, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  });
}
