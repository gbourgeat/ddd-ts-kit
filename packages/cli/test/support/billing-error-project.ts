import { expect } from 'vitest';
import { cli, type CliResult, tempDir } from '../helpers.js';

const TERMS = ['--term', 'Invoice=A request for payment', '--term', 'Issue=To make an invoice final'];

/** `generate error billing ...` with a report in JSON. */
export const generateError = (root: string, ...args: string[]): CliResult =>
  cli(root, 'generate', 'error', 'billing', ...args, '--json');

/** A new project, `init` given `flags`, with a billing context whose glossary knows the invoice and its issue. */
export function billingProject(label: string, ...flags: string[]): string {
  const root = tempDir(label);

  expect(cli(root, 'init', ...flags).code).toBe(0);
  expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core', ...TERMS).code).toBe(0);

  return root;
}
