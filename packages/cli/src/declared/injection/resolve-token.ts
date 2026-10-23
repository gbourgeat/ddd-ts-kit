import type { SourceFile } from '../../check/model/source-file';
import { importedFrom } from '../../check/support/imported-from';
import { declaredKindOf, type DeclaredKind } from './declared-kind-of';
import { exportedNameOf } from './exported-name-of';
import { LANGUAGE_TYPES } from './language-types';
import type { ResolvedToken } from './resolved-token';
import type { Sources } from './sources';

interface Named {
  readonly sources: Sources;
  /** The source that writes the constructor. */
  readonly file: SourceFile;
  /** The name as the constructor writes it. */
  readonly name: string;
}

/**
 * The class a type name of a constructor stands for, through the imports of its file. A
 * package is trusted to export a class under that name: the compiler judges the generated
 * file. A file of the project is read: an interface, a type alias or an enum is no token.
 */
export function resolveToken(named: Named): ResolvedToken {
  const { file, name } = named;

  if (LANGUAGE_TYPES.includes(name)) {
    return { flaw: `is typed \`${name}\`, a type of the language: it names nothing the composition root binds` };
  }

  const imported = importedFrom(file, name);

  if (imported === undefined) {
    return declaredHere(named);
  }

  const exported = exportedNameOf(file, name);

  if (imported.target.kind !== 'file') {
    return { token: { name: exported, from: { kind: 'package', specifier: imported.specifier } } };
  }

  const { path } = imported.target;
  const source = named.sources(path);
  const declared = source === undefined ? undefined : declaredKindOf(source, exported);

  return declared === undefined || declared.kind === 'class'
    ? { token: { name: exported, from: { kind: 'file', path } } }
    : { flaw: notAClass(name, declared, path) };
}

function declaredHere({ file, name }: Named): ResolvedToken {
  const declared = declaredKindOf(file, name);

  if (declared === undefined) {
    return { flaw: `is typed \`${name}\`, which its file neither imports nor declares` };
  }

  if (declared.kind !== 'class') {
    return { flaw: notAClass(name, declared, file.path) };
  }

  return declared.exported
    ? { token: { name, from: { kind: 'file', path: file.path } } }
    : { flaw: `is typed \`${name}\`, a class its file does not export: nothing outside the file can name it` };
}

function notAClass(name: string, { kind }: DeclaredKind, path: string): string {
  const what = kind === 'type' ? 'a type alias' : `${kind === 'interface' || kind === 'enum' ? 'an' : 'a'} ${kind}`;

  return `is typed \`${name}\`, ${what} of ${path}: only a class exists at run time and can be an injection token`;
}
