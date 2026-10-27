import { source } from './source';

/** Where the fixtures keep the glossary of the shared kernel. */
export const SHARED_KERNEL_GLOSSARY = 'src/shared-kernel/CONTEXT.md';

/** The glossary of the shared kernel, as `generate value-object shared-kernel` starts it, with `rows`. */
export function sharedKernelGlossary(...rows: string[]): string {
  return source(
    '# Shared kernel',
    '',
    '## Purpose',
    '',
    'What at least two contexts use and own together.',
    '',
    '## Ubiquitous language',
    '',
    '| Term | Meaning | Not to be confused with |',
    '|---|---|---|',
    ...rows,
  );
}

/** The glossary of the shared kernel that defines Money, the value object its fixtures share. */
export const MONEY_GLOSSARY = {
  [SHARED_KERNEL_GLOSSARY]: sharedKernelGlossary('| Money | An amount in whole cents | |'),
};
