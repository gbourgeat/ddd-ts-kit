import { describe, expect, it } from 'vitest';
import { commentless } from '../src/acceptance/commentless.js';
import { readLock } from '../src/acceptance/read-lock.js';
import { readVerdicts } from '../src/acceptance/read-verdicts.js';
import { scan } from '../src/check/scan/scan.js';
import { Workspace } from '../src/workspace/index.js';
import { tempDir, write } from './helpers.js';

const LOCK = 'test/acceptance/us5.acceptance.lock.json';
const VERDICTS = 'test/acceptance/verdicts';

function workspace(files: Readonly<Record<string, string>>): Workspace {
  const root = tempDir('acceptance-files');

  for (const [file, text] of Object.entries(files)) {
    write(root, file, text);
  }

  return new Workspace(root, false);
}

describe('the lock of a story, read back', () => {
  it('is none when the file is not JSON, or not an object', () => {
    expect(readLock(workspace({ [LOCK]: '{ not json' }), 'US5')).toBeUndefined();
    expect(readLock(workspace({ [LOCK]: '[1, 2]' }), 'US5')).toBeUndefined();
  });

  it('keeps of each field only what has its type', () => {
    const lock = {
      criteria: { AC1: 'abc', AC2: 3 },
      scenarios: [{ title: 7, criteria: ['AC1', 2], fingerprint: 'f1' }, 'not a record'],
      amendments: 'not a list',
    };

    expect(readLock(workspace({ [LOCK]: JSON.stringify(lock) }), 'US5')).toEqual({
      story: 'US5',
      criteria: { AC1: 'abc' },
      scenarios: [{ title: '', criteria: ['AC1'], fingerprint: 'f1' }],
      amendments: [],
    });

    expect(readLock(workspace({ [LOCK]: JSON.stringify({ criteria: [] }) }), 'US5')?.criteria).toEqual({});
  });
});

describe('the verdicts of a story, read back', () => {
  const verdict = (fields: string): string => `# Verdict\n\n${fields}\n`;

  it('reads a file with every field, its backquotes aside, and passes over the rest', () => {
    const ws = workspace({
      [`${VERDICTS}/a.md`]: verdict(
        'Story: US5\nSubject: `AC1`\nFingerprint: f1\nVerdict: amend\nReason: the owner changed it',
      ),
      [`${VERDICTS}/b.md`]: verdict('Story: US5\nSubject: AC2\nFingerprint: f2\nVerdict: refuse'),
      [`${VERDICTS}/c.md`]: verdict('Story: US5\nSubject: AC3\nFingerprint: f3\nVerdict: maybe\nReason: no'),
      [`${VERDICTS}/d.md`]: verdict('Story: US5\nFingerprint: f4\nVerdict: amend'),
      [`${VERDICTS}/e.md`]: verdict('Story: US5\nSubject: AC5\nVerdict: amend'),
      [`${VERDICTS}/f.md`]: verdict('Story: US6\nSubject: AC1\nFingerprint: f1\nVerdict: amend'),
      [`${VERDICTS}/notes.txt`]: 'Story: US5',
    });

    expect(readVerdicts(ws, 'us5')).toEqual([
      {
        file: `${VERDICTS}/a.md`,
        story: 'us5',
        subject: 'AC1',
        fingerprint: 'f1',
        verdict: 'amend',
        reason: 'the owner changed it',
      },
      { file: `${VERDICTS}/b.md`, story: 'us5', subject: 'AC2', fingerprint: 'f2', verdict: 'refuse', reason: '' },
    ]);
  });
});

describe('a source without its comments', () => {
  const without = (source: string): string => commentless(source, scan(source));

  it('blanks a line comment after code that holds two slashes, and keeps the code', () => {
    const source = "const url = 'http://a'; // the address\n";

    expect(without(source)).toBe(`const url = 'http://a'; ${' '.repeat('// the address'.length)}\n`);
  });

  it('blanks a block comment, and one left open at the end of the file', () => {
    expect(without('a; /* b */ c;')).toBe('a;         c;');
    expect(without('a; /* b')).toBe('a;     ');
  });
});
