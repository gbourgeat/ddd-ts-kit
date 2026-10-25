import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';

/** What a decorator recorded through reflect-metadata, which every Nest application loads first. */
export function reflectedMetadata(key: string, target: object, property?: string): unknown {
  const read: unknown = Reflect.get(Reflect, 'getMetadata');

  if (typeof read !== 'function') {
    throw new DeclarationError(
      'Nest controllers are read through reflect-metadata: import it first, as a Nest application does.',
    );
  }

  const value: unknown = Reflect.apply(read, Reflect, property === undefined ? [key, target] : [key, target, property]);

  return value;
}
