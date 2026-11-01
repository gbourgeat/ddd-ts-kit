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
