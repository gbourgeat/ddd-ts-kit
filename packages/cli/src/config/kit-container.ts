import type { Config } from './config';

const KIT_CONTAINERS: ReadonlySet<string> = new Set(['tsyringe', 'inversify', 'awilix']);

/** Whether `@ddd-ts-kit/di` assembles the project: on one of its containers, not by hand and not under NestJS. */
export function onKitContainer(config: Config): boolean {
  return KIT_CONTAINERS.has(config.stack.di);
}

/** The same question, before a `Config` exists: the choice of `--di` alone. */
export function isKitContainer(di: string): boolean {
  return KIT_CONTAINERS.has(di);
}
