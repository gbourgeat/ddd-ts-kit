import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { matchingBracket } from '../text/matching-bracket';

const DEFINE = /\bexport\s+const\s+([\w$]+)\s*=\s*defineIntegrationEvent\s*\(/g;
const ZOD_OBJECT = /\bz\.object\s*\(\s*\{/g;
const MEMBER = /^ {2}(?:readonly\s+)?([A-Za-z_$][\w$]*)[!?]?\s*[:=]/;
const SUFFIX = '.integration-event.ts';
const KEY = /(?:^|[{,]\s*|\n\s*)([A-Za-z_$][\w$]*)\s*:/g;

/** A field of the payload of an integration event, where it is written. */
interface PayloadField {
  readonly name: string;
  readonly file: string;
  readonly line: number;
}

/** An integration event of a context: its constant, its type, what its `personal` option says, its payload. */
export interface PublishedEventOf {
  readonly context: string;
  readonly file: string;
  readonly line: number;
  readonly constant: string;
  readonly type: string;
  readonly personal?: { readonly subject: string; readonly fields: readonly string[] };
  readonly payload: readonly PayloadField[];
}

/**
 * The integration events of `published-language/*.integration-event.ts`: the constant
 * `defineIntegrationEvent` gives, the type, the `personal` option, and the fields of the payload,
 * read from a `z.object({...})` of the declaration (the objects nested in it included) and
 * from the class or the interface of the `.payload.ts` file next to it.
 */
export function publishedEventsOf(project: Project): PublishedEventOf[] {
  const language = project.files.filter(
    (file) => !file.isTest && file.location.area === 'context' && file.location.layer === 'published-language',
  );

  return language
    .filter((file) => file.path.endsWith(SUFFIX))
    .flatMap((file) => {
      const payloadFile = language.find(
        (other) => other.path === file.path.replace(/\.integration-event\.ts$/, '.payload.ts'),
      );

      return eventsIn(file).map((event) => ({
        ...event,
        payload: [...event.payload, ...(payloadFile === undefined ? [] : membersOf(payloadFile))],
      }));
    });
}

function eventsIn(file: SourceFile): PublishedEventOf[] {
  const { code } = file.scan;
  const context = file.location.area === 'context' ? file.location.context : '';

  return [...code.matchAll(DEFINE)].map((call) => {
    const open = call.index + call[0].length - 1;
    const close = matchingBracket(code, open);
    const written = file.text.slice(open, close + 1);
    const personal = personalOf(written);

    return {
      context,
      file: file.path,
      line: file.scan.lineAt(call.index),
      constant: call[1] ?? '',
      type: /\btype:\s*['"]([^'"]+)['"]/.exec(written)?.[1] ?? '',
      ...(personal === undefined ? {} : { personal }),
      payload: zodFields(file, { from: open, to: close }),
    };
  });
}

function personalOf(written: string): PublishedEventOf['personal'] {
  const option = /\bpersonal:\s*\{([^}]*)\}/.exec(written)?.[1];
  const subject = option === undefined ? undefined : /\bsubject:\s*['"]([^'"]+)['"]/.exec(option)?.[1];

  if (option === undefined || subject === undefined) {
    return undefined;
  }

  const fields = /\bfields:\s*\[([^\]]*)\]/.exec(option)?.[1] ?? '';

  return { subject, fields: [...fields.matchAll(/['"]([^'"]+)['"]/g)].map((field) => field[1] ?? '') };
}

/** The keys of the outermost `z.object({...})` calls of a range, and of the objects nested in them: compared by their own name. */
function zodFields(file: SourceFile, range: { readonly from: number; readonly to: number }): PayloadField[] {
  const { code } = file.scan;
  const fields: PayloadField[] = [];
  let at = range.from;

  for (const object of code.slice(range.from, range.to).matchAll(ZOD_OBJECT)) {
    const open = range.from + object.index + object[0].length - 1;

    if (open < at) {
      continue;
    }

    const close = matchingBracket(code, open);

    for (const key of code.slice(open + 1, close).matchAll(KEY)) {
      const name = key[1] ?? '';
      const offset = open + 1 + key.index + key[0].indexOf(name);

      fields.push({ name, file: file.path, line: file.scan.lineAt(offset) });
    }

    at = close;
  }

  return fields;
}

/** The members of the class or the interface of a payload file, one per line at the first indentation. */
function membersOf(file: SourceFile): PayloadField[] {
  return file.text.split('\n').flatMap((line, index) => {
    const name = MEMBER.exec(line)?.[1];

    return name === undefined ? [] : [{ name, file: file.path, line: index + 1 }];
  });
}
