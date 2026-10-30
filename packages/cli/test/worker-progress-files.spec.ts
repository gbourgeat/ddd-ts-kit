import { describe, expect, it } from 'vitest';
import { readableProgress } from '../src/worker/readable-progress';
import { tempDir } from './helpers';
import { committedProject } from './support/committed-project';

describe('the progress of a worker, read from its scope file', () => {
  it('is none in a directory that holds no project', () => {
    expect(readableProgress(tempDir('no-project'), { context: 'billing' })).toBeUndefined();
  });

  it('reads a scope file without rows nor base, as older ones were written, as a worker not started', () => {
    const progress = readableProgress(committedProject('shop', '--context', 'billing:core'), { context: 'billing' });

    expect(progress).toMatchObject({ rows: [], inSlice: [], phase: 'not started', next: { action: 'new-agent' } });
  });
});
