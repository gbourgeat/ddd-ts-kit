import type { JoinPoint } from './join-point.js';

export type Selector = (joinPoint: JoinPoint) => boolean;
