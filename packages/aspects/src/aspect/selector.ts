import type { JoinPoint } from './join-point';

export type Selector = (joinPoint: JoinPoint) => boolean;
