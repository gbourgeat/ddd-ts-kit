import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { Dependencies } from '../dependencies/dependencies.js';
import type { Token } from '../token/token.js';
import { declaring } from './declaring.js';
import type { PortOptions } from './port-options.js';
import type { Settings } from './settings.js';

/**
 * The adapter of a port through which this context calls another one synchronously: in
 * process today, a remote client tomorrow. `@Gateway(StockGateway, [HttpClient])`.
 */
export function Gateway<T, const D extends Dependencies = readonly []>(
  port: Token<T>,
  dependencies?: D,
): ClassDeclarator<T, D>;
export function Gateway<T, const D extends Dependencies = readonly []>(
  port: Token<T>,
  options: PortOptions,
  dependencies?: D,
): ClassDeclarator<T, D>;

export function Gateway<T, D extends Dependencies>(
  port: Token<T>,
  ...settings: Settings<PortOptions, D>
): ClassDeclarator<T, D> {
  return declaring({ role: 'gateway', kind: 'gateway', token: port }, settings);
}
