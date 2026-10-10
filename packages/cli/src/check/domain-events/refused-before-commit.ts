import type { HandlerDependency } from './handler-dependency.js';

const KERNEL = '@ddd-ts-kit/kernel';
const TRUSTED_PACKAGES = [KERNEL, '@ddd-ts-kit/auth'];
/** The ports of the kernel whose effect no transaction covers. */
const OUTSIDE_THE_TRANSACTION = ['Cache', 'Lock', 'RateLimiter', 'JobScheduler', 'EventBus'];

/**
 * Why a handler of `context` that runs before the commit may not depend on this, in the words
 * that follow the name of the dependency; undefined when it may. A port of `application/ports/`
 * of the context is not judged here: where its adapter lives decides.
 */
export function refusedBeforeCommit(context: string, { name, target }: HandlerDependency): string | undefined {
  if (target.kind === 'builtin') {
    return `which comes from ${target.name}`;
  }

  if (target.kind === 'package') {
    return fromPackage(name, target.name);
  }

  const { location } = target;

  if (location.area === 'platform') {
    return 'which comes from the platform';
  }

  if (location.area !== 'context') {
    return undefined;
  }

  if (location.context !== context) {
    return `which belongs to the context ${location.context}`;
  }

  return location.layer === 'infrastructure' ? 'which is imported from infrastructure/' : undefined;
}

function fromPackage(name: string, packageName: string): string | undefined {
  if (!TRUSTED_PACKAGES.includes(packageName)) {
    return `which comes from the package ${packageName}`;
  }

  return packageName === KERNEL && OUTSIDE_THE_TRANSACTION.includes(name)
    ? 'a port of the kernel no transaction covers'
    : undefined;
}
