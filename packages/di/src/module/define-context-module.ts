import type { ContextModule } from './context-module.js';

/** Identity function that types a module definition and keeps it immutable. */
export function defineContextModule(definition: ContextModule): ContextModule {
  return Object.freeze({ ...definition });
}
