import { describe, expect, it } from 'vitest';
import { readable } from '../src/jobs/readable';

describe('reading the settings of a job', () => {
  it('lets a fault of the code through as it is, never as a setting that cannot be read', () => {
    const fault = new TypeError('a fault of the kit');

    expect(() =>
      readable('billing.nightly', () => {
        throw fault;
      }),
    ).toThrow(fault);
  });
});
