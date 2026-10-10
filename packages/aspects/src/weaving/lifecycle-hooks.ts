/** Method names never wrapped: frameworks call them outside of any unit of work. */
export const LIFECYCLE_HOOKS: readonly string[] = [
  'onModuleInit',
  'onModuleDestroy',
  'onApplicationBootstrap',
  'onApplicationShutdown',
  'dispose',
];
