import type { Clock } from '../../application/ports/clock.js';
import type { ExecutionScope } from '../../application/ports/execution-scope.js';
import type { FileKeys } from '../../application/ports/file-keys.js';
import type { IdGenerator } from '../../application/ports/id-generator.js';
import { assertFinalKey } from '../../application/files/assert-final-key.js';

/**
 * Keys of the form `tenants/<tenant>/<area>/<year>/<month>/<id>`, the tenant segment only when
 * the work in progress names a tenant: the files of a tenant then share a prefix that a bucket
 * policy, an export or an erasure can address. A tenant id is a key segment as it is: the kernel
 * refuses any other at every entry (`isTenantId`), so two tenants never share a prefix. An area that would put the key under `staging/`
 * is refused (`INVALID_FILE_KEY`). The id comes from the `IdGenerator`, so a key is
 * not guessable when the generator is not.
 */
export class TenantFileKeys implements FileKeys {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly scope?: Pick<ExecutionScope, 'current'>,
  ) {}

  next(area: string): string {
    const now = this.clock.now();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const key = `${area}/${String(now.getUTCFullYear())}/${month}/${this.ids.next()}`;
    const tenantId = this.scope?.current()?.tenantId;

    return assertFinalKey(tenantId === undefined ? key : `tenants/${tenantId}/${key}`);
  }
}
