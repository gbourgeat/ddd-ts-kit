import type { ErrorMapping } from './error-mapping.js';

/**
 * Says which status and which problem `type` a domain error code answers. One per application:
 * the server and the contract generator must be given the same one.
 */
export abstract class ErrorMapper {
  static readonly tokenKey = 'http.ErrorMapper';

  abstract readonly mapping: ErrorMapping;

  abstract statusOf(code: string): number;

  abstract typeOf(code: string): string;
}
