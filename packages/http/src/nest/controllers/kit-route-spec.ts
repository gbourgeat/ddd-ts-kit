import type { Schema } from '@ddd-ts-kit/validation';
import type { CachePolicy } from '../../cache/cache-policy';
import type { IfMatch } from '../../cache/if-match';
import type { GuardReference } from '../../controller/guard-reference';
import type { DtoType } from './dto-type';

/**
 * What a route says besides what Nest's decorators say (its method, its path, its parameters, its
 * status): who may call it, the refusals it answers, its answer, its name in the contract.
 */
export interface KitRouteSpec {
  /** Names the route in the contract, the function of the generated client and the procedure over /rpc and /trpc. */
  readonly operationId: string;
  readonly summary: string;
  readonly description?: string;
  /** Added to those of @KitRoutes. */
  readonly tags?: readonly string[];
  /** Run after those of @KitRoutes. With none on either, the route is refused: `[Public]` says it is open. */
  readonly guards?: readonly GuardReference[];
  /** Domain error codes the route may answer, added to those of @KitRoutes and of its guards. */
  readonly errors?: readonly string[];
  /** Left out: the status of @HttpCode, else Nest's (201 for POST, 200 otherwise), and no body. */
  readonly response?: {
    readonly status?: number;
    readonly description?: string;
    /** A schema, or a DTO class read through the `schemaOfClass` of the module. */
    readonly body?: Schema<unknown> | DtoType;
  };
  /** Schemas that replace what the types of the parameters give: for a project that does not write DTO classes. */
  readonly request?: {
    readonly params?: Schema<unknown>;
    readonly query?: Schema<unknown>;
    readonly headers?: Schema<unknown>;
    readonly body?: Schema<unknown>;
  };
  readonly deprecated?: boolean;
  readonly produces?: readonly string[];
  readonly consumes?: readonly string[];
  readonly cache?: CachePolicy;
  readonly ifMatch?: IfMatch;
}
