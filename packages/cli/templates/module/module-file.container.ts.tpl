import type { ModuleBuilder, ModuleContext } from '@ddd-ts-kit/di';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export const {{module.camel}}Module = {
  register(builder: ModuleBuilder): void {
    // ddd-ts-kit:registrations
    // /ddd-ts-kit:registrations
  },
  onStart({ resolve }: ModuleContext): void {
    // ddd-ts-kit:start
    // /ddd-ts-kit:start
  },
};
