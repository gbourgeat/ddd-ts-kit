import { declaredBindings } from './declared-bindings';
import type { NamedBinding } from './named-binding';
import { parameterBindings } from './parameter-bindings';
import { propertyBindings } from './property-bindings';

/** Every name a blanked source binds: variables, loop variables, destructured names, parameters and properties. */
export function namedBindings(code: string): NamedBinding[] {
  return [...declaredBindings(code), ...parameterBindings(code), ...propertyBindings(code)].sort(
    (left, right) => left.offset - right.offset,
  );
}
