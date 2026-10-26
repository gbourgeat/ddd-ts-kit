import type { EventNameResolver } from '../events/event-name-resolver';
import type { SourceFile } from '../model/source-file';
import { callArguments } from '../text/call-arguments';
import type { ListPart } from '../text/list-part';
import { splitTopLevel } from '../text/split-top-level';
import { readStoredShape } from './read-stored-shape';
import type { StoredEventDeclaration } from './stored-event-declaration';

const CALL = /(?<![\w$.])defineStoredEvent\s*(?:<[^()]*>)?\s*\(/g;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const VERSION = /^version\s*:\s*(\d+)$/;
const UPCASTERS = /^upcasters\s*:\s*\{/;
const UPCASTER_KEY = /^['"]?(\d+)['"]?\s*:/;
const COMPUTED_NAME = /\[\s*([A-Za-z_$][\w$]*)\.eventName\s*\]\s*:\s*$/;
const ENCODE = /^encode\s*(?::\s*(?:async\s*)?(?:function\s*)?)?\([^()]*\)\s*:\s*([A-Za-z_$][\w$]*)/;

/**
 * The stored events a file declares with `defineStoredEvent`, outside tests. A key written
 * `[InvoiceIssued.eventName]` is read through `eventNameOf`, as the name the class declares.
 */
export function storedEventDeclarations(
  file: SourceFile,
  eventNameOf: EventNameResolver = () => undefined,
): StoredEventDeclaration[] {
  if (file.isTest) {
    return [];
  }

  const { code } = file.scan;

  return [...code.matchAll(CALL)].flatMap((match) => {
    const [type, spec] = callArguments(code, match.index + match[0].length - 1);

    if (type === undefined || !IDENTIFIER.test(type.code) || spec?.code.startsWith('{') !== true) {
      return [];
    }

    return [declarationOf(file, { at: match.index, eventClass: type.code, spec }, eventNameOf)];
  });
}

interface Call {
  readonly at: number;
  readonly eventClass: string;
  readonly spec: ListPart;
}

function declarationOf(
  file: SourceFile,
  { at, eventClass, spec }: Call,
  eventNameOf: EventNameResolver,
): StoredEventDeclaration {
  const properties = splitTopLevel(spec.code.slice(1, spec.code.lastIndexOf('}'))).map((part) => part.code);
  const payloadType = properties.map((property) => ENCODE.exec(property)?.[1]).find((name) => name !== undefined);
  const version = properties.map((property) => VERSION.exec(property)?.[1]).find((value) => value !== undefined);
  const shape = payloadType === undefined ? undefined : readStoredShape(file.scan, payloadType);

  return {
    name: keyBefore(file, at) ?? computedKeyBefore(file, at, eventNameOf),
    eventClass,
    line: file.scan.lineAt(at),
    version: version === undefined ? undefined : Number(version),
    upcasters: upcastersOf(properties),
    payloadType,
    fingerprint: shape?.fingerprint,
    emptyShape: shape?.empty,
    formerFingerprint: shape?.formerFingerprint,
    unresolved: shape?.unresolved ?? [],
  };
}

/** The string literal the call is the value of, as in `'billing.invoice.issued': defineStoredEvent(...)`. */
function keyBefore(file: SourceFile, at: number): string | undefined {
  const { code, strings } = file.scan;

  return strings.find((literal) => literal.end <= at && /^\s*:\s*$/.test(code.slice(literal.end, at)))?.value;
}

/** The name read by a computed key, as in `[InvoiceIssued.eventName]: defineStoredEvent(...)`. */
function computedKeyBefore(file: SourceFile, at: number, eventNameOf: EventNameResolver): string | undefined {
  const eventClass = COMPUTED_NAME.exec(file.scan.code.slice(Math.max(0, at - 200), at))?.[1];

  return eventClass === undefined ? undefined : eventNameOf(eventClass);
}

function upcastersOf(properties: readonly string[]): number[] {
  const upcasters = properties.find((property) => UPCASTERS.test(property));

  if (upcasters === undefined) {
    return [];
  }

  return splitTopLevel(upcasters.slice(upcasters.indexOf('{') + 1, upcasters.lastIndexOf('}'))).flatMap((part) => {
    const key = UPCASTER_KEY.exec(part.code)?.[1];

    return key === undefined ? [] : [Number(key)];
  });
}
