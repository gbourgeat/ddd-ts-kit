import type { Actor } from '@ddd-ts-kit/kernel';
import type { PermissionMapping } from '@ddd-ts-kit/auth/rebac';
import type { OpenFgaApi } from '../client/open-fga-api.js';

export interface OpenFgaAuthorizerOptions {
  readonly client: OpenFgaApi;
  /** Per resource type, the relation of the model each permission of the kit stands for, as for `RelationBasedAuthorizer`. */
  readonly mapping: PermissionMapping;
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
