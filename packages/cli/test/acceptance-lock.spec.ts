import { rmSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { BUILT, LOCK, SLICES, SPEC, SPECIFICATION, STORY } from './support/acceptance-story.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';

// One project for the whole file: the scenarios of US5 written and locked, then changed test after test.
let root: string;

beforeAll(() => {
  root = initProject('--context', 'ordering:core', '--context', 'billing:supporting');
  write(root, 'docs/architecture/slices.md', SLICES);
  write(root, STORY, SPECIFICATION);
  write(root, SPEC, BUILT);

  const locked = cli(root, 'acceptance', 'US5', '--lock');

  if (locked.code !== 0) {
    throw new Error(`acceptance --lock failed: ${locked.stderr}`);
  }
});

const PLACES = '#US5.02 AC1 a customer places an order and reads its number';
const INVOICED = "#US5.03 AC2 the customer's order is invoiced";

/** What `acceptance` reads of the story now: the fingerprint of a scenario or of a criterion. */
function fingerprintOf(kind: 'scenarios' | 'criteria', name: string): string {
  const [story] = jsonAt(cli(root, 'acceptance', 'US5', '--json').json(), 'stories') as Array<Record<string, unknown>>;
  const entries = (story?.[kind] ?? []) as Array<Record<string, string>>;

  return entries.find((entry) => entry['title'] === name || entry['id'] === name)?.['fingerprint'] ?? 'none';
}

/** A verdict of the acceptance-judge agent, as it writes it. */
function verdict(
  file: string,
  fields: { subject: string; fingerprint: string; verdict: string; reason: string },
): void {
  write(
    root,
    `test/acceptance/verdicts/${file}`,
    `# Verdict\n\nStory: US5\nSubject: ${fields.subject}\nFingerprint: ${fields.fingerprint}\nVerdict: ${fields.verdict}\nReason: ${fields.reason}\n`,
  );
}

describe('the lock of an acceptance', () => {
  it('reports a locked scenario changed while its criterion was not, whatever the gate, and refuses to lock it again without a verdict', () => {
    write(root, SPEC, BUILT.replace('201);\n  });\n\n  it(', '200);\n  });\n\n  it('));

    const drifted = cli(root, 'acceptance', 'US5');

    expect(drifted.code).toBe(1);

    expect(drifted.stdout).toContain(
      `${LOCK}  The scenario "${PLACES}" changed since the lock, and no verdict lets it through`,
    );

    expect(drifted.stdout).toContain(
      `have the acceptance-judge agent judge "scenario "${PLACES}"" at fingerprint ${fingerprintOf('scenarios', PLACES)}`,
    );

    const refused = cli(root, 'acceptance', 'US5', '--lock');

    expect(refused.code).not.toBe(0);

    expect(refused.stderr).toContain(
      `Changed since the lock without a verdict that lets it through: scenario "${PLACES}"`,
    );

    expect(refused.stderr).toContain('Never change an acceptance test to make code pass.');
  });

  it('keeps the drift when the judge refused the change', () => {
    verdict('us5-refused.md', {
      subject: `scenario "${PLACES}"`,
      fingerprint: fingerprintOf('scenarios', PLACES),
      verdict: 'refuse',
      reason: 'AC1 says the order is placed: 201 Created, as the locked scenario expected',
    });

    expect(cli(root, 'acceptance', 'US5').stdout).toContain(
      'the acceptance-judge refused it (test/acceptance/verdicts/us5-refused.md: AC1 says the order is placed',
    );

    expect(cli(root, 'acceptance', 'US5', '--lock').code).not.toBe(0);
  });

  it('locks the version the judge let through, its verdict kept as an amendment for the owner to validate', () => {
    rmSync(path.join(root, 'test/acceptance/verdicts/us5-refused.md'));

    const reason = 'AC1 asks for the number of the order, which a 200 with the order answers; 201 was a slip';

    verdict('us5-amended.md', {
      subject: `scenario "${PLACES}"`,
      fingerprint: fingerprintOf('scenarios', PLACES),
      verdict: 'amend',
      reason,
    });

    expect(cli(root, 'acceptance', 'US5').code).toBe(0);

    const locked = cli(root, 'acceptance', 'US5', '--lock');

    expect(locked.code).toBe(0);

    expect(locked.stdout).toContain(
      `Amended by test/acceptance/verdicts/us5-amended.md, for the owner to validate: scenario "${PLACES}": ${reason}`,
    );

    expect(JSON.parse(read(root, LOCK))).toMatchObject({
      amendments: [
        {
          subject: `scenario "${PLACES}"`,
          criteria: ['AC1'],
          reason,
          verdict: 'test/acceptance/verdicts/us5-amended.md',
          on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        },
      ],
    });

    expect(cli(root, 'acceptance', 'US5').stdout).toMatch(
      /amended on \d{4}-\d{2}-\d{2}, for the owner to validate: scenario "#US5\.02 AC1/,
    );
  });

  it('holds a verdict to the version it judged: the scenario changed again drifts again', () => {
    write(root, SPEC, read(root, SPEC).replace('200);', '204);'));

    expect(cli(root, 'acceptance', 'US5').stdout).toContain(
      `The scenario "${PLACES}" changed since the lock, and no verdict lets it through`,
    );

    write(root, SPEC, read(root, SPEC).replace('204);', '200);'));
  });

  it('asks a verdict for a changed criterion, after which its scenarios change with it', () => {
    write(root, STORY, SPECIFICATION.replace('and reads its number', 'and reads its number and its total'));
    write(root, SPEC, read(root, SPEC).replace('200);', '201);'));

    const unjudged = cli(root, 'acceptance', 'US5');

    expect(unjudged.code).toBe(1);
    expect(unjudged.stdout).toContain('The criterion AC1 changed since the lock, and no verdict lets it through');
    expect(unjudged.stdout).not.toContain(`The scenario "${PLACES}" changed`);

    verdict('us5-ac1.md', {
      subject: 'criterion AC1',
      fingerprint: fingerprintOf('criteria', 'AC1'),
      verdict: 'amend',
      reason: 'the owner asked for the total in the answer to question 2',
    });

    const judged = cli(root, 'acceptance', 'US5', '--gate', 'written');

    expect(judged.code).toBe(1);
    expect(judged.stdout).toContain(`"${PLACES}" changed with its criterion`);
    expect(judged.stdout).toContain('criterion AC1 amended by its verdict');
  });

  it('reports a locked scenario removed while its criterion stayed', () => {
    write(root, SPEC, read(root, SPEC).replace(/\n {2}it\("#US5\.03[^]*?\n {2}\}\);\n/, '\n'));

    expect(cli(root, 'acceptance', 'US5').stdout).toContain(
      `The scenario "${INVOICED}" changed since the lock, and no verdict lets it through: restore it as locked (git); or, when it truly failed its criterion or the statement changed, have the acceptance-judge agent judge "scenario "${INVOICED}"" at fingerprint removed.`,
    );
  });
});
