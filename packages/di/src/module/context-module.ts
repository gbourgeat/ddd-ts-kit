import type { ModuleBuilder } from './module-builder';
import type { ModuleContext } from './module-context';

export interface ContextModule {
  /** The bounded context's name; passed to the `decorate` hook as `context`. */
  readonly name: string;

  register(builder: ModuleBuilder): void;

  onStart?(context: ModuleContext): void | Promise<void>;

  onStop?(context: ModuleContext): void | Promise<void>;
}
