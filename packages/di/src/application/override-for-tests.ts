import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Application } from './application.js';
import { ContainerApplication } from './container-application.js';
import { delegatingApplications } from './delegating-applications.js';

/**
 * Swaps a binding for a fake after the application was created. Call it before the
 * first `resolve`: a singleton already built keeps the dependency it was given.
 */
export function overrideForTests<T>(application: Application, target: Token<T>, value: T): void {
  const made = delegatingApplications.get(application) ?? application;

  if (!(made instanceof ContainerApplication)) {
    throw new TypeError('Not an application made by createApplication.');
  }

  made.replace(target, value);
}
