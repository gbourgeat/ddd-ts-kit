import type {
  CriteriaPlan,
  EventStamp,
  ReadModelRows,
  ReadModelTable,
  SearchedRows,
  StampedRow,
  TouchedKey,
} from '@ddd-ts-kit/kernel';
import { UnsupportedRebuildError } from '../errors/unsupported-rebuild-error';
import { DocumentMapper } from '../mapping/document.mapper';
import { RESERVED } from '../mapping/reserved-fields';
import { IndexNames } from '../naming/index-names';
import { planToSearch } from '../query/plan-to-search';
import { IndexProvisioning } from './index-provisioning';
import { OpenSearchDocuments, type DocumentAddress, type ReadDocument } from './open-search-documents';
import type { OpenSearchReadModelOptions } from './open-search-read-model-options';
import { TenantTargets } from './tenant-targets';

/** The document a stamp was read with, so that the write that follows is conditional on it. */
interface ReadVersion {
  readonly address: DocumentAddress;
  readonly document: ReadDocument;
}

/**
 * The read model of one projection in OpenSearch, as `TableReadModelStore` takes it. A replace is
 * conditional on the `_seq_no` and `_primary_term` of the document that was read, so two writes of
 * one key never overwrite each other; `writeIfNewer` of the kernel reads again on a conflict, and
 * gives up with `ConcurrencyError` after its attempts. It has no rebuild yet: `rebuilding()` is
 * always false, and the steps of a rebuild refuse with `UnsupportedRebuildError`.
 */
export class OpenSearchReadModelTable<Row extends object> implements ReadModelTable<Row> {
  private readonly fields: DocumentMapper<Row>;

  private readonly targets: TenantTargets;

  private readonly documents: OpenSearchDocuments;

  private readonly provisioning: IndexProvisioning;

  /** Keyed by the stamp `find` answered, which `writeIfNewer` hands back to `replace`. */
  private readonly versions = new WeakMap<EventStamp, ReadVersion>();

  constructor(options: OpenSearchReadModelOptions<Row>) {
    const tenancy = options.tenancy ?? { strategy: 'none' };

    this.targets = new TenantTargets(new IndexNames(options.name), tenancy);
    this.fields = new DocumentMapper<Row>(options.definition.fields, options.fields ?? {}, this.targets.field);
    this.documents = new OpenSearchDocuments(options.transport, options.refresh);
    this.provisioning = new IndexProvisioning(options.transport, this.fields.mapping(), options.settings);
  }

  /** Creates the index of a read model without tenancy, or adds the fields its mapping lacks. */
  async ensureMapping(): Promise<void> {
    if (this.targets.field !== undefined) {
      throw new TypeError('A read model of tenant data is provisioned per tenant: call provision(tenant)');
    }

    const { index, aliases } = this.targets.shared();

    await this.provisioning.provide(index, aliases);
  }

  /** Creates what a tenant's documents go through: its index, or its filtered alias on the shared index. */
  async provision(tenant: string): Promise<void> {
    if (this.targets.field === undefined) {
      throw new TypeError('A read model without tenancy has no tenant to provision: call ensureMapping()');
    }

    const { index, aliases } = this.targets.ofTenant(tenant);

    await this.provisioning.provide(index, aliases);
  }

  async find(key: string): Promise<StampedRow<Row> | undefined> {
    const { alias, tenant } = this.targets.write();
    const address = { alias, id: this.targets.documentId(key, tenant) };
    const document = await this.documents.get(address);

    // A filtered alias does not filter a get: the tenant of the document is checked here.
    if (document === undefined || !this.owned(document, tenant)) {
      return undefined;
    }

    const stamp = this.fields.stampOf(document.source);

    this.versions.set(stamp, { address, document });

    return {
      key,
      row: document.source[RESERVED.deleted] === true ? undefined : this.fields.rowOf(document.source),
      stamp,
    };
  }

  async insert(entry: StampedRow<Row>): Promise<boolean> {
    if (entry.row === undefined) {
      return false;
    }

    const { alias, tenant } = this.targets.write();
    const document = this.fields.documentOf(entry.row, entry.stamp, tenant);

    const address = { alias, id: this.targets.documentId(entry.key, tenant) };

    return this.documents.put(address, document, { kind: 'absent' });
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    const { alias, tenant } = this.targets.write();
    const address = { alias, id: this.targets.documentId(entry.key, tenant) };
    const read = await this.readVersionOf(held, address, tenant);

    if (read === undefined) {
      return false;
    }

    const document = this.fields.documentOf(entry.row, entry.stamp, tenant);

    return this.documents.put(address, document, { kind: 'read', seqNo: read.seqNo, primaryTerm: read.primaryTerm });
  }

  async search(plan: CriteriaPlan): Promise<SearchedRows<Row>> {
    const { alias, confined, lenient } = this.targets.search();
    const { sources, total } = await this.documents.search(alias, planToSearch(plan, this.fields, confined), lenient);
    const rows = sources.map((source) => this.fields.rowOf(source));

    return plan.kind === 'cursor' || total === undefined ? { rows } : { rows, total };
  }

  async rebuilding(): Promise<boolean> {
    return false;
  }

  touch(): Promise<void> {
    return refused('touch');
  }

  beginRebuild(): Promise<void> {
    return refused('beginRebuild');
  }

  shadow(): ReadModelRows<Row> {
    throw new UnsupportedRebuildError('shadow');
  }

  touched(): Promise<readonly TouchedKey[]> {
    return refused('touched');
  }

  settle(): Promise<void> {
    return refused('settle');
  }

  holdWriters(): Promise<void> {
    return refused('holdWriters');
  }

  promote(): Promise<void> {
    return refused('promote');
  }

  /** Nothing was opened, so nothing is dropped: `ProjectionRebuild` calls it before it begins. */
  async abandonRebuild(): Promise<void> {
    return Promise.resolve();
  }

  private owned(document: ReadDocument, tenant: string | undefined): boolean {
    const { field } = this.targets;

    return field === undefined || document.source[field] === tenant;
  }

  /** The version the held stamp was read at, or the document as it is now when it still holds that stamp. */
  private async readVersionOf(
    held: EventStamp,
    address: DocumentAddress,
    tenant: string | undefined,
  ): Promise<ReadDocument | undefined> {
    const remembered = this.versions.get(held);

    if (remembered?.address.alias === address.alias && remembered.address.id === address.id) {
      return remembered.document;
    }

    const current = await this.documents.get(address);

    return current !== undefined && this.owned(current, tenant) && sameStamp(this.fields.stampOf(current.source), held)
      ? current
      : undefined;
  }
}

function refused<T>(step: string): Promise<T> {
  return Promise.reject(new UnsupportedRebuildError(step));
}

function sameStamp(left: EventStamp, right: EventStamp): boolean {
  return (
    left.eventId === right.eventId &&
    left.occurredAt.getTime() === right.occurredAt.getTime() &&
    left.version === right.version
  );
}
