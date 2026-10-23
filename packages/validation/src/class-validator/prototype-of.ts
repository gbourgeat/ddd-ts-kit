import type { DtoClass } from './dto-class';

/** The object the instances of a class inherit from, where decorators record their metadata. */
export function prototypeOf(dto: DtoClass<object>): object {
  const { prototype }: { readonly prototype: unknown } = dto;

  return typeof prototype === 'object' && prototype !== null ? prototype : {};
}
