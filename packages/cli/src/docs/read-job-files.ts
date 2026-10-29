import { toName } from '../naming';
import type { Workspace } from '../workspace';
import type { JobFacts } from './context-facts';
import { type ContextTree, roleFilesOf, wiringTextOf } from '../model-modules';

const FOLDER = 'application/scheduling';
const SUFFIX = '.job.ts';
const SCHEDULE = String.raw`(\{[^}]*\})`;

/** A job of a context, with the file that declares it. */
export interface JobFile extends JobFacts {
  /** The `*.job.ts` file, from the root of the project. */
  readonly file: string;
}

/**
 * The jobs of a context, each with its file: one per `*.job.ts` file, with the name and the
 * schedule its registration writes, on the class (`@Scheduled`) or in the module file of the
 * context (`builder.job(...)`, `platform.jobs.register(...)`) or of one of its modules, and the
 * command it sends.
 */
export function readJobFiles(ws: Workspace, tree: ContextTree, context: string): JobFile[] {
  const module = wiringTextOf(ws, tree, context);

  return roleFilesOf(ws, tree, FOLDER)
    .filter(({ name }) => name.endsWith(SUFFIX) && !name.endsWith('.spec.ts'))
    .map((file) => {
      const source = ws.read(file.path) ?? '';
      const job = toName(file.name.slice(0, -SUFFIX.length));

      const [, name, schedule] =
        registrationOf(job.pascal, job.camel)
          .map((pattern) => pattern.exec(`${source}\n${module}`))
          .find((match) => match !== null) ?? [];

      return {
        file: file.path,
        name: name ?? `${job.pascal}Job`,
        schedule: scheduleText(schedule ?? ''),
        command: /\bnew (\w+?)Command\(/.exec(source)?.[1] ?? '',
      };
    });
}

/** How each wiring family writes the registration of the job of a class. */
function registrationOf(pascal: string, camel: string): RegExp[] {
  return [
    new RegExp(String.raw`@Scheduled\(\s*'([^']+)',\s*${SCHEDULE}`),
    new RegExp(String.raw`\.job\(\s*'([^']+)',\s*${SCHEDULE}\s*\)\s*\.handledBy\(\s*${pascal}Job\b`),
    new RegExp(String.raw`\.register\(\{\s*name:\s*'([^']+)',\s*schedule:\s*${SCHEDULE},\s*run:[^\n]*\b${camel}Job\b`),
  ];
}

/** The text a diagnostic of the kernel gives a schedule: `every 15m`, `cron 0 7 * * 1-5 (UTC)`. */
function scheduleText(written: string): string {
  const cron = /\bcron:\s*'([^']+)'/.exec(written)?.[1];
  const every = /\bevery:\s*(?:'([^']+)'|([\d_]+))/.exec(written);

  if (cron !== undefined) {
    return `cron ${cron} (${/\btimeZone:\s*'([^']+)'/.exec(written)?.[1] ?? 'UTC'})`;
  }

  if (every === null) {
    return '';
  }

  return `every ${every[1] ?? `${Number((every[2] ?? '').replaceAll('_', ''))}ms`}`;
}
