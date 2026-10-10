import type { BindingAspect } from '@ddd-ts-kit/kernel/declarations';

export const wrapped: string[] = [];

/** An aspect of a declaration that writes what it is told of the instance it wraps. */
export const noting: BindingAspect = (instance, info) => {
  wrapped.push(`${info.className} as ${info.kind ?? 'nothing'} in ${info.context}`);

  return instance;
};
