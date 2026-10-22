import type { BulkheadOptions } from '../bulkhead/bulkhead-options';
import { bulkheadAdvice } from '../bulkhead/bulkhead';
import type { AsyncMethodDecorator } from './async-method-decorator';
import { decoratorOf } from './decorator-of';

/** See `bulkhead`. */
export function Bulkhead(options: BulkheadOptions): AsyncMethodDecorator {
  return decoratorOf(bulkheadAdvice(options));
}
