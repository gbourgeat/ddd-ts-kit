import { ConcurrencyError } from '../../domain/errors/concurrency-error';

/**
 * A write found nothing under its key, its insert was refused by a conflict, and the next read
 * still found nothing: the key is held out of the reach of this work, by another tenant. The key
 * of a read model is unique across tenants. A `ConcurrencyError`, so what catches that still does,
 * but one no retry settles.
 */
export class ReadModelKeyHeldElsewhereError extends ConcurrencyError {
  constructor(readonly key: string) {
    super(key);

    this.message = `The key "${key}" of the read model is held by another tenant: the key of a read model is unique across tenants. When two tenants can use the same key, make the key carry the tenant (acme:${key}) or generate it`;
  }
}
