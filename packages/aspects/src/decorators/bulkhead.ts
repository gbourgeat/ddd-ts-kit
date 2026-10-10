import type { BulkheadOptions } from '../bulkhead/bulkhead-options.js';
import { bulkheadAdvice } from '../bulkhead/bulkhead.js';
import type { AsyncMethodDecorator } from './async-method-decorator.js';
import { decoratorOf } from './decorator-of.js';

/** See `bulkhead`. */
export function Bulkhead(options: BulkheadOptions): AsyncMethodDecorator {
  return decoratorOf(bulkheadAdvice(options));
}
