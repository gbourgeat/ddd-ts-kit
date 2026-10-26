import { CliError } from '../cli-error';
import type { CodecDeclaration } from './declared-stored-events';

/**
 * Refuses to record what the reader cannot read: a shape of no type found for its data or of no member would be
 * recorded as the hash of nothing, and the lock would vouch for it. Nothing is written when one is refused.
 */
export function refuseUnreadableStoredEvents(declared: readonly CodecDeclaration[]): void {
  const refused = declared.flatMap((declaration) => {
    const reason = reasonOf(declaration);

    return reason === undefined ? [] : [`${declaration.file}:${declaration.line}: ${reason}`];
  });

  if (refused.length > 0) {
    throw new CliError(
      `Cannot record the stored shape of ${refused.length === 1 ? 'a stored event' : 'stored events'}, nothing is written:\n  ${refused.join('\n  ')}`,
      'Declare the stored shape as a named type with its fields in the codec file (`interface InvoiceIssuedData { readonly cents: number }`), answer it from encode, then run `ddd-ts-kit docs --stored-events` again.',
    );
  }
}

/** Why the shape of a declaration cannot be recorded, or `undefined` when it can. */
function reasonOf({ eventClass, payloadType, fingerprint, emptyShape }: CodecDeclaration): string | undefined {
  if (payloadType === undefined) {
    return `the encode of ${eventClass} does not name the type of the data it stores`;
  }

  if (fingerprint === undefined) {
    return `${payloadType}, the data of ${eventClass}, is not declared in this file`;
  }

  return emptyShape === true ? `${payloadType}, the data of ${eventClass}, declares no member` : undefined;
}
