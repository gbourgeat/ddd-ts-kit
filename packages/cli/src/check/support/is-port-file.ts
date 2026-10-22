import type { Location } from '../model/location';

/** A port file: `domain/repositories/*.repository.ts` or `application/ports/*.port.ts` of a context, specs aside. */
export function isPortFile(file: string, location: Location): boolean {
  if (location.area !== 'context' || /\.(?:spec|test)\.ts$/.test(file)) {
    return false;
  }

  const [folder] = location.inside;

  if (location.layer === 'domain') {
    return folder === 'repositories' && file.endsWith('.repository.ts');
  }

  return location.layer === 'application' && folder === 'ports' && file.endsWith('.port.ts');
}
