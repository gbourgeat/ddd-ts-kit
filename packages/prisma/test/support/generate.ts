import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const generated = `${packageRoot}test/generated`;
const lock = `${packageRoot}test/.generating`;

/** Where the DDL of the test schema lands, as `prisma migrate diff` writes it. */
export const DDL_PATH = `${generated}/ddl.sql`;

const HEADER = `generator client {
  provider            = "prisma-client"
  output              = "./client"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "postgresql"
  schemas  = ["public", "messaging", "billing_core", "read_side", "privacy"]
}
`;

const INVOICE = `
/// The aggregate table of the example repository: one schema per bounded context, the tenant
/// and the four audit fields named after the kernel \`TenantScoped\` and \`AuditStamp\`.
model Invoice {
  id        String   @id
  amount    Int
  status    String
  version   Int
  tenantId  String   @map("tenant_id")
  createdAt DateTime @map("created_at") @db.Timestamptz(3)
  createdBy String   @map("created_by")
  updatedAt DateTime @map("updated_at") @db.Timestamptz(3)
  updatedBy String   @map("updated_by")

  /// The order of the list query, tie-breaker included, so a page is read from the index.
  @@index([tenantId, amount, id], map: "invoices_tenant_amount_idx")
  @@map("invoices")
  @@schema("billing_core")
}
`;

const READ_MODEL = `
/// The read model of the criteria and read model contracts: one field of every type, and the
/// four fields of the shipped template that order the events of a projection.
model CriteriaContractRow {
  id               String    @id
  status           String
  title            String
  seats            Int
  price            Decimal
  startsAt         DateTime  @map("starts_at") @db.Timestamptz(3)
  cancelledAt      DateTime? @map("cancelled_at") @db.Timestamptz(3)
  room             String?
  remote           Boolean
  tenantId         String    @map("tenant_id")
  lastEventId      String    @map("last_event_id")
  lastEventAt      DateTime  @map("last_event_at") @db.Timestamptz(3)
  lastEventVersion BigInt?   @map("last_event_version")
  deleted          Boolean   @default(false)

  @@index([tenantId, startsAt, id], map: "criteria_contract_tenant_starts_idx")
  @@map("criteria_contract")
  @@schema("read_side")
}
`;

/**
 * A read model in the default schema, with a whole number too large for an `Int`: the table of
 * a read model that names no schema, and a `BigInt` read back as a number.
 */
const LEDGER = `
model LedgerRow {
  id               String   @id
  balance          BigInt
  lastEventId      String   @map("last_event_id")
  lastEventAt      DateTime @map("last_event_at") @db.Timestamptz(3)
  lastEventVersion BigInt?  @map("last_event_version")
  deleted          Boolean  @default(false)

  @@map("ledger")
  @@schema("public")
}
`;

/**
 * The rows of a context about persons, for the erasure contract: three personal columns of two
 * types, a file column, the tenant. A personal column that is not a text accepts null: pseudonymised,
 * it reads nothing.
 */
const PEOPLE = `
model PrivacyPerson {
  id           String   @id
  personId     String   @map("person_id")
  displayName  String   @map("display_name")
  email        String
  age          Int?
  avatarKey    String?  @map("avatar_key")
  tenantId     String   @map("tenant_id")
  registeredAt DateTime @map("registered_at") @db.Timestamptz(3)
  endedAt      DateTime? @map("ended_at") @db.Timestamptz(3)

  @@map("people")
  @@schema("privacy")
}

/// The same table, its age not nullable: what a pseudonymisation cannot write to.
model PrivacyPersonStrict {
  id           String   @id
  personId     String   @map("person_id")
  displayName  String   @map("display_name")
  email        String
  age          Int
  avatarKey    String?  @map("avatar_key")
  tenantId     String   @map("tenant_id")
  registeredAt DateTime @map("registered_at") @db.Timestamptz(3)
  endedAt      DateTime? @map("ended_at") @db.Timestamptz(3)

  @@map("people_strict")
  @@schema("privacy")
}
`;

const inSchema = (models: string, schema: string): string => models.replaceAll(/^}$/gm, `  @@schema("${schema}")\n}`);

/**
 * The schema the tests run on, built from the fragments the package ships, the way a consuming
 * project would: the models as they are in `public`, and a renamed copy of the outbox in a
 * schema of its own.
 */
async function composeSchema(): Promise<string> {
  const fragment = await readFile(`${packageRoot}prisma/outbox.postgresql.prisma`, 'utf8');
  const eventStore = await readFile(`${packageRoot}prisma/event-store.postgresql.prisma`, 'utf8');

  const renamed = fragment
    .replace('model OutboxRecord ', 'model MessagingOutboxRecord ')
    .replace('model ProcessedEvent ', 'model MessagingProcessedEvent ')
    // The outbox of a multi-tenant project: the field the fragment leaves commented out.
    .replace('  // tenantId      String?   @map("tenant_id")', '  tenantId      String?   @map("tenant_id")');

  return [
    HEADER,
    inSchema(fragment, 'public'),
    inSchema(renamed, 'messaging'),
    inSchema(eventStore, 'public'),
    INVOICE,
    READ_MODEL,
    LEDGER,
    PEOPLE,
  ].join('\n');
}

async function prisma(args: readonly string[]): Promise<void> {
  await run(process.execPath, [require.resolve('prisma/build/index.js'), ...args], {
    cwd: generated,
    env: { ...process.env, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  });
}

async function generate(schema: string, stamp: string): Promise<void> {
  await rm(generated, { recursive: true, force: true });
  await mkdir(generated, { recursive: true });
  await writeFile(`${generated}/schema.prisma`, schema);

  // `migrate diff` wants a datasource URL even though it never connects for an empty source.
  await writeFile(
    `${generated}/prisma.config.ts`,
    [
      "import { defineConfig } from 'prisma/config';",
      '',
      'export default defineConfig({',
      "  schema: './schema.prisma',",
      "  datasource: { url: 'postgresql://unused:unused@127.0.0.1:1/unused' },",
      '});',
      '',
    ].join('\n'),
  );

  await prisma(['generate', '--schema', 'schema.prisma']);
  await prisma(['migrate', 'diff', '--from-empty', '--to-schema', 'schema.prisma', '--script', '-o', 'ddl.sql']);
  await writeFile(`${generated}/stamp`, stamp);
}

const isUpToDate = async (stamp: string): Promise<boolean> =>
  (await readFile(`${generated}/stamp`, 'utf8').catch(() => '')) === stamp;

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Spec files run in parallel workers: a directory is created atomically, so it makes a lock. */
async function acquireLock(): Promise<void> {
  for (;;) {
    try {
      await mkdir(lock);

      return;
    } catch {
      const age =
        Date.now() -
        (await stat(lock).then(
          (entry) => entry.mtimeMs,
          () => Date.now(),
        ));

      if (age > 120_000) {
        // Left behind by a run that was killed.
        await rm(lock, { recursive: true, force: true });
      }

      await pause(100);
    }
  }
}

/**
 * Generates the Prisma client of the tests and the DDL of their schema into `test/generated`
 * (git-ignored) when they are missing or older than the shipped fragment. Every spec file
 * awaits it before importing its suite, so `npx vitest run` needs no manual step.
 */
export async function ensureGeneratedClient(): Promise<void> {
  const schema = await composeSchema();
  const version: unknown = require('prisma/package.json').version;

  const stamp = createHash('sha256')
    .update(`${String(version)}\n${schema}`)
    .digest('hex');

  if (await isUpToDate(stamp)) {
    return;
  }

  await acquireLock();

  try {
    if (!(await isUpToDate(stamp))) {
      await generate(schema, stamp);
    }
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
