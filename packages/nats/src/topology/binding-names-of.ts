import type { BindingNames } from './binding-names.js';
import type { ConsumerBinding } from './consumer-binding.js';

/** A durable name holds neither dot nor wildcard: every other character becomes `_`. */
export function bindingNamesOf({ consumer, type }: ConsumerBinding, subjectPrefix: string): BindingNames {
  const durable = `${sanitized(consumer)}_${sanitized(type)}`;

  return {
    durable,
    subject: `${subjectPrefix}.${type}`,
    deadSubject: `dead.${subjectPrefix}.${sanitized(consumer)}.${type}`,
  };
}

function sanitized(name: string): string {
  return name.replaceAll(/[^A-Za-z0-9_-]/g, '_');
}
