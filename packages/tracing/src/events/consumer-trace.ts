/**
 * How the span of a consumed event relates to the one that published it. `continue`: its
 * child, in the same trace, so one action reads end to end in one place. `link`: the root of
 * a new trace that links to it, for a system whose traces would otherwise never end (fan-out
 * to many consumers, long retry chains).
 */
export type ConsumerTrace = 'continue' | 'link';
