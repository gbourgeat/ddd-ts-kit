import { describe, expect, it } from 'vitest';
import { registry } from '../src/declarations/registry/registry';

const REGISTRY = Symbol.for('@ddd-ts-kit/kernel/declarations/v1');

describe('the registry of the declarations', () => {
  it('is one per process, under the global symbol, and replaces what stands there without being one', () => {
    const current = registry();
    const held: unknown = Reflect.get(globalThis, REGISTRY);

    expect(registry()).toBe(current);

    try {
      Reflect.set(globalThis, REGISTRY, { classes: new Set() });
      const replaced = registry();

      expect(replaced).not.toBe(current);
      expect(replaced.byClass).toBeInstanceOf(WeakMap);
      expect(registry()).toBe(replaced);
    } finally {
      Reflect.set(globalThis, REGISTRY, held);
    }

    expect(registry()).toBe(current);
  });
});
