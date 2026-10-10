// The trace a thrown error failed in, for a report made once its spans are over (a job, a dead letter).
export const failedTraces = new WeakMap<object, string>();
