import type { ImportTarget } from '../model/import-target';
import type { SourceFile } from '../model/source-file';
import { inLayer } from '../support/in-layer';
import { isOutsidePlace } from './is-outside-place';
import { typeDeclarations } from './type-declarations';

/**
 * The names a file reads from another language, with where they come from
 * (`catalog/published-language`, `"legacy-erp"`, `this file`), in source order: a name imported
 * from a published language (its own context's included, the contract being a language of its
 * own), a type imported from a package, a name imported from `infrastructure/anti-corruption/` or
 * `infrastructure/external/` of a context, and in those two folders the interfaces and type
 * aliases the file declares at its top, which describe an outside record as it arrives. The model
 * of a context reads none: `domain/` speaks the language of its context only.
 */
export function otherLanguageOf(file: SourceFile): Map<string, string> {
  const names = new Map<string, string>();

  if (inLayer(file, 'domain') !== undefined) {
    return names;
  }

  for (const { target, names: bound, typeNames } of file.imports) {
    const place = otherPlace(target);

    if (place !== undefined) {
      for (const name of target.kind === 'package' ? typeNames : bound) {
        names.set(name, place);
      }
    }
  }

  if (isOutsidePlace(file.location)) {
    for (const declaration of typeDeclarations(file.scan.code).filter(({ topLevel }) => topLevel)) {
      names.set(declaration.name, 'this file');
    }
  }

  return names;
}

function otherPlace(target: ImportTarget): string | undefined {
  if (target.kind === 'package') {
    return `"${target.name}"`;
  }

  const location = target.kind === 'file' ? target.location : undefined;

  if (location?.area !== 'context') {
    return undefined;
  }

  if (location.layer === 'published-language') {
    return `${location.context}/published-language`;
  }

  return isOutsidePlace(location) ? `${location.context}/infrastructure/${location.inside[0] ?? ''}` : undefined;
}
