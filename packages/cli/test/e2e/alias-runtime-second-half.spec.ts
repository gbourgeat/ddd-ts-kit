import { describeTheAliasAtRunTime, halfOfTheCases } from './alias-runtime-cases';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): the second half of the stacks, held to what the alias
 * promises at run time; the first half is alias-runtime.spec.ts, which the alias job runs
 * beside this one.
 */
describeTheAliasAtRunTime(halfOfTheCases(1));
