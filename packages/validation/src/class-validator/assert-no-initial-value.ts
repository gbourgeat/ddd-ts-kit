import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { DtoClass } from './dto-class';

/**
 * Refuses a class one of whose fields has an initial value: class-transformer keeps it for a
 * field the input lacks, so `reason = ''` under `@IsString()` lets an input without `reason`
 * pass as if it carried an empty one. A field written `note?: string` or `declare note: string`
 * holds no value on a fresh instance, and is let through.
 */
export function assertNoInitialValue(dto: DtoClass<object>): void {
  const initialized = Object.entries(new dto())
    .filter(([, value]) => value !== undefined)
    .map(([field]) => field);

  const [first] = initialized;

  if (first === undefined) {
    return;
  }

  throw new DeclarationError(
    `${dto.name} gives ${initialized.map((field) => `\`${field}\``).join(', ')} an initial value, which class-transformer keeps for a field the input lacks: an input without it would pass. Declare each without an initial value, \`declare ${first}: <its type>;\`; a field whose absence means a default is \`@IsOptional()\` and read with \`?? <default>\`.`,
  );
}
