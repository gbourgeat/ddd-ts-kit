/** The configured authorizer cannot enumerate what an actor may access. */
export class ListingNotSupportedError extends Error {
  constructor() {
    super('The authorizer does not implement listAccessible: it cannot turn a permission into an access scope');
    this.name = 'ListingNotSupportedError';
  }
}
