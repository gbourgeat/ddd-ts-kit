import { expect } from 'vitest';
import { cli, tempDir } from '../helpers';

/** A project in the explicit style: a billing context that knows two terms, and a shipping context. */
export function explicitProject(label: string): string {
  const root = tempDir(label);

  expect(cli(root, 'init', '--style', 'explicit').code).toBe(0);

  expect(
    cli(
      root,
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--term',
      'Invoice=A request for payment',
      '--term',
      'Issue=To make an invoice final',
    ).code,
  ).toBe(0);

  expect(cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting').code).toBe(0);

  return root;
}
