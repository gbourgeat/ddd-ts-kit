import type { SourceFile } from '../../check/model/source-file';
import { escapeRegExp } from '../../check/text/escape-reg-exp';

export interface DeclaredKind {
  readonly kind: 'class' | 'interface' | 'type' | 'enum' | 'const' | 'function';
  readonly exported: boolean;
}

/** What `file` declares under `name` at its top level, or undefined when it declares nothing by that name. */
export function declaredKindOf(file: SourceFile, name: string): DeclaredKind | undefined {
  const declaration = new RegExp(
    `(?<![\\w$.])(export\\s+)?(?:default\\s+)?(?:declare\\s+)?(?:abstract\\s+)?(class|interface|type|enum|const|function)\\s+${escapeRegExp(name)}(?![\\w$])`,
  );

  const match = declaration.exec(file.scan.code);
  const kind = match?.[2];

  return isKind(kind) ? { kind, exported: match?.[1] !== undefined } : undefined;
}

function isKind(value: string | undefined): value is DeclaredKind['kind'] {
  return value !== undefined && ['class', 'interface', 'type', 'enum', 'const', 'function'].includes(value);
}
