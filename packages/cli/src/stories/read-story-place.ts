import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../config/values/is-record';
import type { StoryPlace } from './story-place';
import { STORY_SCOPE_FILE } from './story-scope-file';

/** The story of the worktree at `root`; undefined outside the worktree of a story or when its file is not one. */
export function readStoryPlace(root: string): StoryPlace | undefined {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(root, STORY_SCOPE_FILE), 'utf8'));

    if (!isRecord(raw) || typeof raw['story'] !== 'string' || typeof raw['base'] !== 'string') {
      return undefined;
    }

    return {
      story: raw['story'],
      base: raw['base'],
      ...(typeof raw['baseCommit'] === 'string' ? { baseCommit: raw['baseCommit'] } : {}),
      branch: typeof raw['branch'] === 'string' ? raw['branch'] : '',
      kind: raw['kind'] === 'fix' ? 'fix' : 'story',
      ...(typeof raw['from'] === 'string' ? { from: raw['from'] } : {}),
    };
  } catch {
    return undefined;
  }
}
