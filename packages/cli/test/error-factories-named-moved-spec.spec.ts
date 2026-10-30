import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers';

const ERRORS = 'src/contexts/scheduling/domain/errors';
const UNIT = 'src/contexts/scheduling/test/unit';

interface Applied {
  moved: string[];
  removed: string[];
  manual: string[];
}

const lines = (...all: string[]): string => `${all.join('\n')}\n`;

describe('error-factories --apply to the named form, the spec of a class per error named otherwise than its class', () => {
  it('moves the spec under the name of the class of its own, and removes the old one', () => {
    const root = tempDir('error-factories-named-moved-spec');

    expect(cli(root, 'init', '--refusals', 'classes').code).toBe(0);
    cli(root, 'generate', 'context', 'scheduling', '--classification', 'core', '--term', 'Slot=A time to book');

    write(
      root,
      `${ERRORS}/late.error.ts`,
      lines(
        "import { DomainError } from '@ddd-ts-kit/kernel';",
        '',
        'export class TooLateError extends DomainError {',
        "  readonly code = 'TOO_LATE';",
        '}',
      ),
    );

    write(
      root,
      `${UNIT}/late.error.spec.ts`,
      lines("describe('TooLateError', () => {", "  it('refuses late', () => new TooLateError());", '});'),
    );

    expect(cli(root, 'error-factories', '--plan').code).toBe(0);

    const applied = cli(root, 'error-factories', '--apply', '--json').json() as Applied;

    expect(applied.moved).toEqual(['TooLateError -> TooLate.withMessage']);
    expect(applied.removed).toContain(`${UNIT}/late.error.spec.ts`);
    expect(exists(root, `${UNIT}/late.error.spec.ts`)).toBe(false);
    expect(read(root, `${UNIT}/too-late.error.spec.ts`)).toContain("describe('TooLate', () => {");
    expect(read(root, `${UNIT}/too-late.error.spec.ts`)).toContain('TooLate.withMessage(');
  });
});
