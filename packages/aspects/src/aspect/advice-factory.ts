import type { Advice } from './advice.js';
import type { JoinPoint } from './join-point.js';

/**
 * Builds the advice of one method of one instance, once, when the instance is wrapped: state
 * kept in the closure is per instance and per method. Answering `undefined` leaves the method
 * alone.
 */
export type AdviceFactory = (joinPoint: JoinPoint) => Advice | undefined;
