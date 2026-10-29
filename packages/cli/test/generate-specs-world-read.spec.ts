import { describe, expect, it } from 'vitest';
import { read, write } from './helpers';
import { billingProject, CANCEL, hint, ISSUE, UNIT, WORLD, WORLD_IMPORT } from './support/billing-world-project';

const UNREAD =
  /could not be read by the generator \(it looks for `export function aBillingWorld`\): this spec arranges itself\./;

/** billing with its world, generated, then rewritten by `edit`. */
function editedWorld(label: string, edit: (world: string) => string) {
  const project = billingProject(label);

  project.run('generate', 'repository', 'billing', 'Invoice');
  project.run('generate', 'test-world', 'billing');
  write(project.root, WORLD, edit(read(project.root, WORLD)));

  return project;
}

describe('the world of billing, as a team rewrote it', () => {
  it('finds the builder by its name, a helper exported above it aside', () => {
    const { root, run } = editedWorld('world-read-helper', (world) =>
      world.replace(
        'export async function aBillingWorld',
        'export function noon() {\n  return 12;\n}\n\nexport async function aBillingWorld',
      ),
    );

    expect(hint(run(...ISSUE).notes)).toEqual([]);

    const spec = read(root, `${UNIT}/issue-invoice.handler.spec.ts`);

    expect(spec).toContain(WORLD_IMPORT);
    expect(spec).not.toContain('noon');
  });

  it('reads options that extend a type and hold an object type of their own', () => {
    const { root, run } = editedWorld('world-read-extends', (world) =>
      world
        .replace(
          'export interface BillingWorldOptions {',
          'interface Clocked {\n  readonly now?: Date;\n}\n\nexport interface BillingWorldOptions extends Clocked {\n  readonly audit?: { readonly on: boolean; readonly by?: { readonly id: string } };',
        )
        .replace('  readonly now?: Date;\n  readonly idPrefix', '  readonly idPrefix'),
    );

    expect(hint(run(...ISSUE).notes)).toEqual([]);
    expect(read(root, `${UNIT}/issue-invoice.handler.spec.ts`)).toContain(WORLD_IMPORT);
  });

  it('says it could not read the options it needs from a type it does not follow, and suggests no --force', () => {
    const { root, run } = editedWorld('world-read-options', (world) =>
      world
        .replace(
          'export interface BillingWorldOptions {',
          'interface Hosted {\n  readonly modules?: readonly ContextModule[];\n}\n\nexport interface BillingWorldOptions extends Hosted {',
        )
        .replace('  readonly modules?: readonly ContextModule[];\n  readonly fakes', '  readonly fakes'),
    );

    const notes = hint(run(...ISSUE).notes);
    const spec = read(root, `${UNIT}/issue-invoice.handler.spec.ts`);

    expect(notes).toEqual([
      expect.stringContaining('could not be read by the generator (it looks for `modules` in `BillingWorldOptions`)'),
    ]);

    expect(notes.join('')).not.toContain('--force');
    expect(spec).toContain('createTestApplication({');
    expect(spec).not.toContain('--force');
  });

  it('says a world it cannot read is not read, never that test-world would shorten it nor that --force would', () => {
    const { root, run } = editedWorld('world-read-arrow', () => 'export const aBillingWorld = async () => ({});\n');

    const notes = hint(run(...CANCEL).notes);
    const spec = read(root, `${UNIT}/cancel-invoice.handler.spec.ts`);

    expect(notes).toEqual([expect.stringMatching(UNREAD)]);
    expect(spec).toMatch(new RegExp(`\\n// The world of billing ${UNREAD.source}\\nfunction arrange`));

    for (const text of [notes.join(''), spec]) {
      expect(text).not.toContain('--force');
      expect(text).not.toContain('shortens');
    }
  });
});
