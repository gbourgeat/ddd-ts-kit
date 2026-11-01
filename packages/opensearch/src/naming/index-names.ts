import { InvalidIndexNameError } from '../errors/invalid-index-name-error';

/** No `-` in a read model name, so that `<name>-` starts the aliases of one read model only. */
const READ_MODEL_NAME = /^[a-z0-9][a-z0-9_]{0,99}$/;

/** What OpenSearch accepts inside an index name, out of what a tenant id may hold: no upper case. */
const TENANT_NAME = /^[a-z0-9_-]{1,63}$/;

/** The generation every index is created at: a rebuild fills the next one and moves the aliases. */
const GENERATION = 1;

/**
 * The names of one read model. Every read and write goes through an alias, never an index:
 *
 * - `<name>` reaches every document: the one index without tenancy, every tenant under an elevation;
 * - `<name>-<tenant>` reaches one tenant: its index, or the shared index filtered on its tenant;
 * - `<name>.v<generation>` is the shared index, `<name>-<tenant>.v<generation>` the index of a tenant.
 *
 * A tenant holds no `.` and a read model name no `-`, so no alias of a tenant is ever the name of
 * an index, nor of another read model's alias.
 */
export class IndexNames {
  constructor(readonly name: string) {
    if (!READ_MODEL_NAME.test(name)) {
      throw new InvalidIndexNameError(
        'read model',
        name,
        'lower case letters, digits and "_", starting with a letter or a digit, at most 100',
      );
    }
  }

  /** The alias of every document of the read model. */
  get all(): string {
    return this.name;
  }

  get sharedIndex(): string {
    return `${this.name}.v${String(GENERATION)}`;
  }

  aliasOf(tenant: string): string {
    return `${this.name}-${checked(tenant)}`;
  }

  indexOf(tenant: string): string {
    return `${this.aliasOf(tenant)}.v${String(GENERATION)}`;
  }
}

function checked(tenant: string): string {
  if (!TENANT_NAME.test(tenant)) {
    throw new InvalidIndexNameError('tenant', tenant, 'lower case letters, digits, "_" and "-", at most 63');
  }

  return tenant;
}
