import type { AdviceFactory } from '../aspect/advice-factory';
import { adviseMethod } from '../weaving/advise-method';
import { advisePrototypeMethod } from '../weaving/advise-prototype-method';
import type { AsyncMethodDecorator } from './async-method-decorator';

/**
 * The decorator form of any advice factory, by the same code as the wrappers of the composition
 * root. In the standard mode each instance gets the method wrapped when it is constructed; in
 * the legacy mode, which has no initializer, at its first call.
 */
export function decoratorOf(advise: AdviceFactory): AsyncMethodDecorator {
  return (target: unknown, second: unknown, descriptor?: unknown): undefined => {
    if (isStandardContext(second)) {
      adviseAtConstruction(second, advise);
    } else {
      adviseOnThePrototype({ prototype: target, name: second, descriptor }, advise);
    }
  };
}

interface StandardContext {
  readonly kind: unknown;
  readonly name: unknown;
  readonly static: unknown;
  readonly private: unknown;
  readonly addInitializer: (initializer: (this: object) => void) => void;
}

/** The standard call hands a context object; the legacy one hands the name of the method there. */
function isStandardContext(value: unknown): value is StandardContext {
  return typeof value === 'object' && value !== null && 'kind' in value && 'addInitializer' in value;
}

function adviseAtConstruction(context: StandardContext, advise: AdviceFactory): void {
  const { name } = context;

  if (context.static === true || context.private === true || typeof name !== 'string') {
    throw misplaced();
  }

  context.addInitializer(function (this: object) {
    adviseMethod(this, name, advise);
  });
}

interface LegacyCall {
  readonly prototype: unknown;
  readonly name: unknown;
  readonly descriptor: unknown;
}

function adviseOnThePrototype({ prototype, name, descriptor }: LegacyCall, advise: AdviceFactory): void {
  if (typeof prototype !== 'object' || typeof name !== 'string') {
    throw misplaced();
  }

  if (typeof descriptor !== 'object' || descriptor === null || !('value' in descriptor)) {
    throw misplaced();
  }

  descriptor.value = advisePrototypeMethod(name, descriptor.value, advise);
}

function misplaced(): TypeError {
  return new TypeError('An aspect decorates a public instance method with a string name');
}
