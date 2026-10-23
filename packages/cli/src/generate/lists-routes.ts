import type { Config } from '../config';
import { isDeclared } from './is-declared';

/**
 * Whether the routes of a context are a list written by hand in `<context>.routes.ts`: always
 * for function routes, and for controllers of an explicit context. Declared controllers reach
 * the application through the generated file of their context, or by discovery.
 */
export function listsRoutes(config: Config): boolean {
  return config.stack.http !== 'none' && !(isDeclared(config) && config.stack.routes === 'controllers');
}
