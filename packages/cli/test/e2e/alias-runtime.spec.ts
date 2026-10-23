import { describeTheAliasAtRunTime, halfOfTheCases } from './alias-runtime-cases';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): the first half of the stacks, held to what the alias
 * promises at run time; the second half is alias-runtime-second-half.spec.ts, which the alias
 * job runs beside this one.
 */
describeTheAliasAtRunTime(halfOfTheCases(0));
