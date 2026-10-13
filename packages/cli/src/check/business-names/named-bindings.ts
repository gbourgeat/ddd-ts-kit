import { declaredBindings } from './declared-bindings.js';
import type { NamedBinding } from './named-binding.js';
import { parameterBindings } from './parameter-bindings.js';
import { propertyBindings } from './property-bindings.js';

/** Every name a blanked source binds: variables, loop variables, destructured names, parameters and properties. */
export function namedBindings(code: string): NamedBinding[] {
  return [...declaredBindings(code), ...parameterBindings(code), ...propertyBindings(code)].sort(
    (left, right) => left.offset - right.offset,
  );
}
