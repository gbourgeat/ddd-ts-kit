import { defineAspect, type Aspect } from '../../src/index.js';

/** An aspect that writes what it sees around each call: enough to observe the weaving. */
export function recording(journal: string[], label = 'around'): Aspect {
  return defineAspect((joinPoint) => async ({ proceed }) => {
    journal.push(`${label} > ${joinPoint.className}.${joinPoint.method}`);

    try {
      return await proceed();
    } finally {
      journal.push(`${label} < ${joinPoint.className}.${joinPoint.method}`);
    }
  });
}
