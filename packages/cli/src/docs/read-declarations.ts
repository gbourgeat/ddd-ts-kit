import { argumentsOf } from '../check/declarations/arguments-of.js';
import { declaredAs } from '../check/declarations/declared-as.js';
import type { Decoration } from '../check/declarations/decoration.js';
import { literalIn } from '../check/declarations/literal-in.js';
import { optionOf } from '../check/declarations/option-of.js';
import { scan, type Scan } from '../check/scan/scan.js';
import { declaredRoleOf } from '../declared/index.js';
import { filesUnder } from '../generate/files-under.js';
import type { Workspace } from '../workspace/index.js';
import type { DeclaredBinding, DeclaredFacts, DeclaredUseCase } from './declared-facts.js';

/** One exported class of a role file, with the declaration that gives it its role. */
interface Declared {
  /** The suffix of the role file: `command`, `query`, `policy`... */
  readonly suffix: string;
  readonly className: string;
  readonly decoration: Decoration;
  readonly source: Scan;
  readonly text: string;
}

/** What the decorators of the role files of a context say. */
export function readDeclarations(ws: Workspace, directory: string): DeclaredFacts {
  const declared = declaredClasses(ws, directory);
  const carrying = (...decorators: string[]): Declared[] => declared.filter(({ decoration }) => decorators.includes(decoration.name));
  const binding = (found: Declared): DeclaredBinding => ({ name: found.className, token: argument(found, 0) });

  return {
    useCases: carrying('Requires', 'Public').map(useCase),
    integrationEventHandlers: carrying('IntegrationEventHandler').map((found) => ({ name: found.className, consumer: option(found, 'consumer'), event: argument(found, 0) })),
    policies: carrying('Policy').map((found) => ({ name: option(found, 'name') || found.className, permission: permission(found) })),
    gateways: carrying('Gateway').map(binding),
    adapters: carrying('Repository', 'Adapter').map(binding),
  };
}

/** The classes the role files of a context export with the decorator of their role, in the order of their paths. */
function declaredClasses(ws: Workspace, directory: string): Declared[] {
  return filesUnder(ws, directory).flatMap((file) => {
    const role = declaredRoleOf(file);
    const text = role === undefined ? undefined : ws.read(`${directory}/${file}`);

    if (role === undefined || text === undefined) return [];

    const source = scan(text);

    return declaredAs(source, role.decorators).map(({ declared, decoration }) => ({ suffix: role.suffix, className: declared.name, decoration, source, text }));
  });
}

function useCase(found: Declared): DeclaredUseCase {
  return {
    kind: found.suffix === 'query' ? 'query' : 'command',
    name: found.className.replace(/(?:Command|Query)$/, ''),
    requires: found.decoration.name === 'Public' ? 'public' : permission(found),
  };
}

/** The permission a declaration names: the literal inside its first argument (`permissions['invoice.issue']`), else the argument as written. */
function permission(found: Declared): string {
  const first = argumentsOf(found.source, found.decoration)[0];

  return (first === undefined ? undefined : literalIn(found.source, first)) ?? argument(found, 0);
}

/** An argument of the declaration as it is written in the source. */
function argument({ source, decoration, text }: Declared, index: number): string {
  const found = argumentsOf(source, decoration)[index];

  return found === undefined ? '' : text.slice(found.start, found.start + found.code.length);
}

function option({ source, decoration }: Declared, key: string): string {
  return optionOf(source, decoration, key)?.literal ?? '';
}
