import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { ModulesContainer } from '@nestjs/core';
import { nestRoutesRegistry } from './nest-routes-registry';

/**
 * Refuses the start when a controller the kit serves is also among the `controllers` of a Nest
 * module: Nest's router would serve it a second time, through its own pipeline, with none of the
 * guards, validation and problem documents of the kit.
 */
export function assertNotRoutedByNest(modules: ModulesContainer): void {
  const { routes } = nestRoutesRegistry();

  for (const module of modules.values()) {
    for (const token of module.controllers.keys()) {
      const prototype: unknown = typeof token === 'function' ? Reflect.get(token, 'prototype') : undefined;

      if (typeof token === 'function' && typeof prototype === 'object' && prototype !== null && routes.has(prototype)) {
        throw new DeclarationError(
          `${token.name} carries @KitRoute and is in the controllers of the Nest module ${module.metatype.name}: Nest would serve it through its own pipeline too. Give it to createControllersModule only.`,
        );
      }
    }
  }
}
