import type { DeclaredClass } from './declared-class';

/** The names a class is read under: its own, then those of the classes it extends, however far. */
export function lineageOf(classes: readonly DeclaredClass[], name: string, seen: readonly string[] = []): string[] {
  if (seen.includes(name)) {
    return [];
  }

  const bases = classes.filter(({ shape }) => shape.name === name).flatMap(({ shape }) => shape.superclass ?? []);

  return [name, ...bases.flatMap((base) => lineageOf(classes, base, [...seen, name]))];
}
