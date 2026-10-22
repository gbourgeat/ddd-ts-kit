import type { ImportTarget } from '../../project/resolve-import';

export function describeTarget(target: ImportTarget): string {
  if (target.kind !== 'file') {
    return `"${target.name}"`;
  }

  const { location } = target;

  if (location.area === 'context') {
    return `${location.context}/${location.layer === 'module' ? 'module file' : location.layer}`;
  }

  return location.area === 'other' ? target.path : location.area;
}
