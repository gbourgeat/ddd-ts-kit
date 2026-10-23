import type { Actor } from '@ddd-ts-kit/kernel';
import type { Schema } from '@ddd-ts-kit/auth/rebac';
import type { OpenFgaApi } from '../client/open-fga-api.js';

export interface OpenFgaAuthorizerOptions {
  readonly client: OpenFgaApi;
  /** The relationship schema the model of the store was generated from: a permission is asked as the derived relation named after it. */
  readonly schema: Schema;
  /** The subject an actor is in the tuples. Default `<actor type>:<actor id>`, such as `user:ada`. */
  readonly subjectOf?: (actor: Actor) => string;
  /**
   * The most objects the server answers to one `ListObjects`: its `OPENFGA_LIST_OBJECTS_MAX_RESULTS`,
   * 1000 by default. The server cuts a longer list without saying so, so an answer that reaches it
   * is refused (`ReverseExpansionLimitError`) rather than taken as the whole scope. Set it to the
   * value the server runs with.
   */
  readonly listObjectsLimit?: number;
}
