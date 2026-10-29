import { USAGE } from './usage';

/** The lines of the usage that start with `ddd-ts-kit <command>`, each with the lines that continue it. */
export function usageLinesOf(command: string): string[] {
  const found: string[] = [];
  let inside = false;

  for (const line of USAGE.split('\n')) {
    if (line.startsWith('  ddd-ts-kit ')) {
      inside = line === `  ddd-ts-kit ${command}` || line.startsWith(`  ddd-ts-kit ${command} `);
    } else if (!line.startsWith('   ')) {
      inside = false;
    }

    if (inside) {
      found.push(line);
    }
  }

  return found;
}
