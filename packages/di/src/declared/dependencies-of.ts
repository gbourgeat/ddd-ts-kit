import { describeToken, injectedDependencies, type Dependencies } from '@ddd-ts-kit/kernel/declarations';
import { WiringError } from '../errors/wiring-error.js';
import type { Declarer } from '../wiring/declarer.js';

const REGENERATE =
  'Run `ddd-ts-kit docs`, which reads the constructors and rewrites the generated file of the context (<context>.declarations.ts, or <context>.dependencies.ts under discovery), and assemble the context from that file';

interface Declared {
  readonly implementation: new (...args: never) => unknown;
  /** The list of the decorator, when it wrote one. */
  readonly listed: Dependencies | undefined;
  readonly module: string;
  readonly declaredBy: Declarer;
}

/**
 * What the constructor of a declared class receives: the list of its decorator when there is
 * one, the list the generated file of its context registered from its constructor signature
 * otherwise. A class that takes parameters and has no list, or a list of another length, is
 * refused here, at composition time: nothing is ever injected as `undefined`.
 */
export function dependenciesOf(declared: Declared): Dependencies {
  const { implementation, listed } = declared;
  const dependencies = listed ?? injectedDependencies(implementation);

  if (dependencies === undefined) {
    return implementation.length === 0 ? [] : refuse('MISSING_DEPENDENCIES', declared, noList(declared));
  }

  if (isShort(declared, dependencies) || isStale(declared, dependencies)) {
    return refuse('DEPENDENCY_ARITY', declared, otherLength(declared, dependencies));
  }

  return dependencies;
}

function isShort({ implementation }: Declared, dependencies: Dependencies): boolean {
  return dependencies.length < implementation.length;
}

/** A generated list is derived from the constructor: longer than it, it was read from another one. */
function isStale({ implementation, listed }: Declared, dependencies: Dependencies): boolean {
  return listed === undefined && implementation.length > 0 && dependencies.length !== implementation.length;
}

function refuse(code: 'MISSING_DEPENDENCIES' | 'DEPENDENCY_ARITY', declared: Declared, message: string): never {
  throw new WiringError(code, `${whoOf(declared)} ${message}`);
}

function whoOf({ implementation, module, declaredBy }: Declared): string {
  const file = declaredBy.file === undefined ? '' : ` (${declaredBy.file})`;

  return `Class ${implementation.name}${file} of module "${module}"`;
}

function noList({ implementation }: Declared): string {
  return `takes ${countOf(implementation.length)} and no dependency list is known for it: its decorator names none, and no generated file that was loaded registered one. ${REGENERATE}; the composition root then injects each parameter by its type.`;
}

function otherLength({ implementation, listed }: Declared, dependencies: Dependencies): string {
  const named = dependencies.map((token) => describeToken(token)).join(', ');
  const source = listed === undefined ? 'the generated file of its context registered' : 'its decorator lists';

  const fix =
    listed === undefined
      ? `The generated file is stale. ${REGENERATE}.`
      : 'Name one token per constructor parameter, in order, or remove the list and let the constructor state the dependencies.';

  return `takes ${countOf(implementation.length)} and ${source} ${dependencies.length} ([${named}]): a parameter would be left undefined. ${fix}`;
}

function countOf(parameters: number): string {
  return parameters === 1 ? '1 constructor parameter' : `${parameters} constructor parameters`;
}
