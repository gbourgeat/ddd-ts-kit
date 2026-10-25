import type { MapperTarget } from './module-name-mapper';

/** A target of the mapper as `jest.config.js` writes it: one path, or the paths tried in order. */
export function mapperTargetText(target: MapperTarget): string {
  return typeof target === 'string' ? `'${target}'` : `[${target.map((path) => `'${path}'`).join(', ')}]`;
}
