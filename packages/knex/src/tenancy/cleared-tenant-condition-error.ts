/** A statement of a tenant helper asked to forget its conditions, the tenant condition among them. */
export class ClearedTenantConditionError extends Error {
  constructor(method: string) {
    super(
      `\`${method}\` cannot clear the conditions of a statement confined to a tenant: start a new statement from the helper`,
    );

    this.name = 'ClearedTenantConditionError';
  }
}
