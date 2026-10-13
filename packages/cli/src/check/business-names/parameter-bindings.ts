import { splitTopLevel } from '../text/split-top-level.js';
import { identifierAt } from './identifier-at.js';
import type { NamedBinding } from './named-binding.js';
import { parameterLists } from './parameter-lists.js';
import { patternBindings } from './pattern-bindings.js';

const MODIFIERS = /^(?:(?:public|private|protected|readonly|override)\s+)+/;

/** The parameters of every function, method, signature and arrow of a source; a parameter property is a property. */
export function parameterBindings(code: string): NamedBinding[] {
  return parameterLists(code).flatMap((list) => {
    if ('single' in list) {
      return [{ name: identifierAt(code, list.single), offset: list.single, kind: 'parameter' as const }];
    }

    return splitTopLevel(code.slice(list.open + 1, list.close)).flatMap((part) =>
      parameter(code, list.open + 1 + part.start, part.code),
    );
  });
}

function parameter(code: string, start: number, text: string): NamedBinding[] {
  const modifiers = MODIFIERS.exec(text)?.[0].length ?? 0;
  const at = start + modifiers + (text.startsWith('...', modifiers) ? 3 : 0);
  const opener = code.charAt(at);

  if (opener === '{' || opener === '[') {
    return patternBindings(code, at);
  }

  const name = identifierAt(code, at);

  if (name === '' || name === 'this') {
    return [];
  }

  return [{ name, offset: at, kind: modifiers > 0 ? 'property' : 'parameter' }];
}
