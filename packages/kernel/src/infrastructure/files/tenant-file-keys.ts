import type { Clock } from '../../application/ports/clock.js';
import type { ExecutionScope } from '../../application/ports/execution-scope.js';
import type { FileKeys } from '../../application/ports/file-keys.js';
import type { IdGenerator } from '../../application/ports/id-generator.js';
import { assertFileKey } from '../../application/files/assert-file-key.js';
import { isFileKey } from '../../application/files/is-file-key.js';

/**
 * Keys of the form `tenants/<tenant>/<area>/<year>/<month>/<id>`, the tenant segment only when
 * the work in progress names a tenant: the files of a tenant then share a prefix that a bucket
 * policy, an export or an erasure can address. The id comes from the `IdGenerator`, so a key is
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

    return assertFileKey(tenantId === undefined ? key : `tenants/${segmentOf(tenantId)}/${key}`);
  }
}

function segmentOf(tenantId: string): string {
  return isFileKey(tenantId) && !tenantId.includes('/') ? tenantId : Buffer.from(tenantId).toString('hex');
}
