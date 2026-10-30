/**
 * An alternative added at the top of a statement of a tenant helper, where SQL would bind it
 * outside the tenant condition. The alternatives go in a group, beside the condition.
 */
export class UngroupedOrError extends Error {
  constructor(method: string) {
    super(
      `\`${method}\` cannot stand at the top of a statement confined to a tenant: group the alternatives, \`.where((either) => either.where(a).orWhere(b))\``,
    );

    this.name = 'UngroupedOrError';
  }
}
