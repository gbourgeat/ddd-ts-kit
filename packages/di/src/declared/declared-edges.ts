import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { EdgeBinding } from '../wiring/edge-binding';

/**
 * The classes of the edge the contexts declared, each resolved by its class. The platform asks
 * for the controllers and hands them to the transport:
 * `controllerRoutes(resolve(DeclaredEdges).of('controller'), { resolve })`.
 */
export abstract class DeclaredEdges {
  static readonly tokenKey = 'di.DeclaredEdges';

  abstract readonly list: readonly EdgeBinding[];

  /** The classes declared under one word, in the order the modules declared them. */
  abstract of(part: string): readonly Token<unknown>[];
}
