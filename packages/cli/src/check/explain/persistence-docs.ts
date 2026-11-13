import type { RuleDoc } from '../model/rule-doc';

export const PERSISTENCE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'persistence/migration-history': {
    why: 'Migrations are applied in the order of their names, and several people add them at the same time. Numbered by an index, two branches each write `0002_...` and the order between them is a guess; named by a random word, nobody knows what a migration does. A timestamp and a description, `20261012093000_add-invoices`, keep every branch apart. drizzle-kit adds a journal and a chain of snapshots on top: its migrator applies only the entries newer than the last one a database applied, so an entry merged out of order is skipped without a word, and a snapshot generated from the same parent as another makes the next migration miss a change. After a merge, the migration of the branch is generated again on top of the main branch (under drizzle-kit, `npx ddd-ts-kit drizzle-generate --replay` deletes and generates them again). A worker of a parallel build names the migration it needs `working-<what-it-does>`: its branch runs green in its worktree, and the conductor generates the real one on the trunk, so a working migration found outside a worktree is one that was merged as is.',
    bad: `migrations/
  0002_brave_falcon.sql          # an index, a random name
  0002_quiet_owl.sql             # the same index, from another branch
  meta/_journal.json             # entries 0002 and 0002, two snapshots with one parent`,
    good: `migrations/
  20261010120000_add-invoices.sql
  20261012093000_add-payments.sql   # generated again after main took add-invoices
  meta/_journal.json                # one entry each, in order, each snapshot from the one before`,
  },
  'persistence/primary-key-order': {
    why: 'A table has one primary key. When a migration changes it, drizzle-kit may write the statement that adds the new key before the one that drops the old key, or drop a column before the key that holds it; PostgreSQL refuses either, and the migration fails only when it runs, on the database of a colleague or of a deployment. `drizzle-generate` warns when it writes such a migration; this rule keeps reporting it until the migration is fixed, so that a warning that scrolled away is not merged. A dropped constraint is a primary key when the snapshot before the migration records it or its name ends in `_pkey` or `_pk`. Fix the migration while no database has applied it: move the `DROP CONSTRAINT` above, or write the change yourself with `npm run db:generate -- <name> --custom`.',
    bad: `ALTER TABLE "invoices" ADD CONSTRAINT "invoices_id_issuer_pk" PRIMARY KEY("id","issuer");--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_pkey";   -- too late: the ADD above already failed`,
    good: `ALTER TABLE "invoices" DROP CONSTRAINT "invoices_pkey";--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_id_issuer_pk" PRIMARY KEY("id","issuer");`,
  },
  'persistence/read-model-listed': {
    why: 'The application checks the tables of its read models when it starts, and `npm run db:read-models` before a deployment: a table an upgrade left as it was stops the start and not the first event that reaches it. Both read the stores `<platformDir>/database/read-model-tables.ts` lists, and no other. `generate read-model` lists the store it writes and `init` those it finds, but a store written by hand and never listed is checked by nothing, and nothing says so. This rule reads the tree as `init` does, by one reading: a store is a class of a context that is not abstract and extends `DrizzleReadModelStore`, `KnexReadModelStore`, `PrismaReadModelStore` or `TypeOrmReadModelStore`, named so, directly or through classes of the project. The list answers for it when an entry of `LISTED` under its context names it or a class that extends it (the class the list declares to build a generic store), when `NOT_LISTED` names it, which the start tells, or when a comment holds `<context>: <Store>` with the reason it is left out. The list is held to the tree too: an entry whose class the file neither imports nor declares, whose import leads to no file or to a file that does not name the class, or whose class another context declares, and a line of `NOT_LISTED` whose class its context no longer names. What the rule does not judge: an abstract class, a store in memory or in a search engine and a class over `TableReadModelStore` of the kernel, which have no table the kit knows; a store of the tests; a store whose base is reached through a namespace, an alias or a class expression; whether a class that extends a store reads the same table; the reason a comment gives; what a barrel or a package exports. An entry spread into `LISTED` or built by a call cannot be read: the rule says so once and judges no store. A project on one of the four ORM with stores and no list, generated before 0.112.0, is reported once, since nothing checks any of its tables; without one of them `init` writes no list and no check, and the rule says nothing.',
    bad: `// src/contexts/billing/infrastructure/persistence/knex-late-invoices.repository.ts, written by hand
export class KnexLateInvoices extends KnexReadModelStore<LateInvoice> implements LateInvoices { .. }

// src/platform/database/read-model-tables.ts
const LISTED = [
  ['billing', KnexInvoiceSummaries],   // KnexLateInvoices is not there: its table is never read
];`,
    good: `import { KnexLateInvoices } from '@/contexts/billing/infrastructure/persistence/knex-late-invoices.repository';

const LISTED = [
  ['billing', KnexInvoiceSummaries],
  ['billing', KnexLateInvoices],
  // billing: KnexNightlyTotals, left out: its table is dropped and rebuilt each night
];`,
  },
  'persistence/no-file-content': {
    why: 'A file in a column is read whole into the memory of the application and of the database, travels in every backup, every replica and every dump, swells the table its rows share pages with, and cannot be handed out by a short signed link: an upload of a few megabytes becomes a transaction, a replication lag and a backup to restore. An object store is made for it: it streams, it is cheap per gigabyte, it has lifecycle rules and signed links. The row keeps what the domain needs to know about the file, its reference.',
    bad: `export const invoices = pgTable('invoices', {
  receipt: bytea('receipt'),                 // the content of the file
  receiptBase64: text('receipt_base64'),     // the same, as text
});`,
    good: `export const invoices = pgTable('invoices', {
  receiptKey: text('receipt_key'),           // where the file storage keeps it
  receiptSize: integer('receipt_size'),
  receiptMediaType: text('receipt_media_type'),
  receiptChecksum: text('receipt_checksum'), // sha256 of the content
});`,
  },
  'files/port-not-connector': {
    why: 'Where files live is a choice of the platform: a directory in development, the memory in the tests, a bucket in a deployment. A handler or an aggregate that names a connector has made that choice for every environment, and its tests no longer run on the memory connector. The port says what is needed, streams in and out, signed links, and the platform binds the connector of each environment.',
    bad: `import { LocalFileStorage } from '@ddd-ts-kit/kernel';

export class AttachReceiptHandler {
  private readonly files = new LocalFileStorage({ directory: 'files' });
}`,
    good: `import type { FileKeys, FileStaging } from '@ddd-ts-kit/kernel';

export class AttachReceiptHandler {
  constructor(private readonly staging: FileStaging, private readonly keys: FileKeys) {}
}`,
  },
  'files/upload-content-rule': {
    why: "An upload is checked twice: the media type the client declares must be one the route accepts, and the first bytes must prove that type, by the signature of its format or, for text, by holding no control character and being valid UTF-8 (or any single-byte text when the upload says `text: 'single-byte'`). A type the kit has no such rule for can never be proven: `application/vnd.ms-excel`, which a browser on Windows sends for a CSV, `application/octet-stream`, a video. A route that accepts it without saying how its content is judged answers 415 to every file of it, which looks like a client mistake and is a declaration that could never work. So the route states the rule in `contentRules`: `text`, the content is text under another name, or `unchecked`, the route takes the bytes as they are and says so in its contract. `@ddd-ts-kit/http` refuses the route when it is declared, with the same sentence; this rule reads the upload of a *.route.ts or a *.controller.ts when its `mediaTypes` and `contentRules` are written as literals, and reports the string. Reported too: an entry that is no media type (`*/*`, a bare word), a family none of whose types has a rule (`video/*`), and a stated rule that does nothing, for a type the kit already verifies or one the upload does not accept. The rule of a family never reaches a type a browser runs (`image/svg+xml`, `text/html`, `application/xhtml+xml`, `text/javascript`, `application/javascript`): accepted, such a type is reported until `contentRules` names it. A list built elsewhere (a constant, a spread) is not read here: the declaration of the route judges it.",
    bad: `@Controller({
  method: 'POST',
  path: '/statements',
  upload: { field: 'file', maxBytes: 5_000_000, mediaTypes: ['text/csv', 'application/vnd.ms-excel'] },
  response: { status: 201 },
})`,
    good: `@Controller({
  method: 'POST',
  path: '/statements',
  upload: {
    field: 'file',
    maxBytes: 5_000_000,
    mediaTypes: ['text/csv', 'application/vnd.ms-excel'],
    text: 'single-byte',
    contentRules: { 'application/vnd.ms-excel': 'text' },
  },
  response: { status: 201 },
})`,
  },
  'search/store-from-platform': {
    why: 'Which node a read model reaches and how its tenants are kept apart are choices of the platform, made once for every store: a context that opens a transport or names a tenancy of its own has chosen them for itself, out of reach of the provisioning, of the credentials of the deployment and of the tenancy of the project, and one of its stores may read the documents of every tenant; spreading the answer of `search.options` to replace its tenancy is the same choice made over the platform. The domain and the use cases see a read model through its port, as on any store.',
    bad: `import { OpenSearchReadModelStore, fetchTransport } from '@ddd-ts-kit/opensearch';

export class SearchInvoiceList extends OpenSearchReadModelStore<InvoiceRow> implements InvoiceList {
  constructor() {
    super({ transport: fetchTransport({ node: 'http://search:9200' }), name: 'billing_invoices', definition: invoiceCriteria });
  }
}`,
    good: `import { OpenSearchReadModelStore } from '@ddd-ts-kit/opensearch';
import { SearchIndexes } from '@/platform/search/search-indexes';

export class SearchInvoiceList extends OpenSearchReadModelStore<InvoiceRow> implements InvoiceList {
  constructor(search: SearchIndexes) {
    super(search.options('billing_invoices', invoiceCriteria));
  }
}`,
  },
};
