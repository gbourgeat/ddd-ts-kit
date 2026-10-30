import type { Changed, ContextChanges, Digest, NewSpecTitles, ReadingPart, ReviewedFile, SpecTitle } from './digest';

const PART_TITLES: Readonly<Record<ReadingPart, string>> = {
  context: 'Context',
  domain: 'Domain',
  application: 'Application',
  presentation: 'Presentation',
  infrastructure: 'Infrastructure',
  tests: 'Tests',
  elsewhere: 'Elsewhere',
};

/**
 * The digest in Markdown, for the top of a pull request and the report of a story: what changes
 * by context, the new spec titles, the files to review in reading order, then those regenerated.
 * Its sections are bold lines, not headings, so that it reads the same wherever it is pasted.
 */
export function formatDigest(digest: Digest): string {
  return [
    summaryOf(digest),
    '',
    '**By context**',
    '',
    ...contextsLines(digest.contexts),
    '',
    '**New spec titles**',
    '',
    ...specsLines(digest.specs),
    '',
    '**To review, in reading order**',
    '',
    ...reviewLines(digest.review),
    '',
    '**Regenerated, do not review**',
    '',
    digest.regenerated.length === 0 ? 'None.' : digest.regenerated.map(code).join(', '),
    ...(digest.notes.length === 0 ? [] : ['', ...digest.notes.map((note) => `- ${note}`)]),
  ].join('\n');
}

function summaryOf({ branch, base, baseCommit, review, regenerated }: Digest): string {
  const files = review.length + regenerated.length;

  return `Digest of ${code(branch)} against ${code(base)} (${code(baseCommit.slice(0, 7))}): ${files} ${files === 1 ? 'file' : 'files'} changed, ${review.length} to review, ${regenerated.length} regenerated.`;
}

function contextsLines(contexts: readonly ContextChanges[]): string[] {
  if (contexts.length === 0) {
    return ['No use case, permission, route, event or port changed.'];
  }

  return contexts.flatMap((context) => [
    `- ${code(context.name)}${context.change === 'changed' ? '' : ` (context ${context.change})`}`,
    ...contextLines(context).map((line) => `  ${line}`),
  ]);
}

function contextLines(context: ContextChanges): string[] {
  const lines = [
    ...context.useCases.map((useCase) =>
      line('use case', useCase, `${useCase.kind} ${code(useCase.name)} (${code(useCase.permission)})`),
    ),
    ...context.permissions.map((permission) =>
      line('permission', permission, `${code(permission.name)}, ${grantsText(permission.grants)}`),
    ),
    ...context.routes.map((route) =>
      line(
        'route',
        route,
        `${code(`${route.method} ${route.path}`)} -> ${code(route.useCase)} (${code(route.permission)}), ${errorsText(route.errors)}`,
      ),
    ),
    ...context.publishedEvents.map((event) =>
      line(
        'published event',
        event,
        `${code(event.type)} ${event.versions.map((version) => `v${version}`).join(', ')}`,
      ),
    ),
    ...context.consumedEvents.map((event) =>
      line('consumed event', event, `${code(event.type)} from ${event.from}, by ${code(event.handler)}`),
    ),
    ...context.ports.map((port) =>
      line('port', port, `${code(port.name)} [${port.kind}], ${adaptersText(port.adapters)}`),
    ),
  ];

  return lines.length === 0 ? ['- no use case, permission, route, event or port of its own'] : lines;
}

function line(what: string, entry: Changed<object>, text: string): string {
  return `- ${what} ${entry.change}: ${text}`;
}

function grantsText(grants: readonly string[]): string {
  return grants.length === 0 ? 'granted to no role by name' : `granted to ${grants.map(code).join(', ')}`;
}

function errorsText(errors: readonly string[]): string {
  return errors.length === 0 ? 'no error code' : `errors ${errors.map(code).join(', ')}`;
}

function adaptersText(adapters: readonly string[]): string {
  return adapters.length === 0 ? 'no adapter' : `by ${adapters.map(code).join(', ')}`;
}

function specsLines(specs: readonly NewSpecTitles[]): string[] {
  const written = specs.filter((spec) => spec.titles.length > 0);
  const generated = specs.reduce((count, spec) => count + spec.generated, 0);

  return [
    ...(written.length === 0 && generated === 0 ? ['No new spec title.'] : []),
    ...written.map((spec) => `- ${code(spec.file)}: ${spec.titles.map(titleText).join('; ')}`),
    ...(generated === 0
      ? []
      : [
          `- and ${generated} ${generated === 1 ? 'title as the kit generated it' : 'titles as the kit generated them'}`,
        ]),
  ];
}

function titleText({ title, state }: SpecTitle): string {
  return state === 'stated' ? title : `${title} (${state === 'planned' ? 'planned' : 'put aside'})`;
}

function reviewLines(review: readonly ReviewedFile[]): string[] {
  if (review.length === 0) {
    return ['No file to review.'];
  }

  const parts = [...new Set(review.map((file) => file.part))];

  return parts.map(
    (part) =>
      `- ${PART_TITLES[part]}: ${review
        .filter((file) => file.part === part)
        .map(fileText)
        .join(', ')}`,
  );
}

function fileText({ path, change }: ReviewedFile): string {
  return change === 'changed' ? code(path) : `${code(path)} (${change === 'added' ? 'new' : 'removed'})`;
}

function code(text: string): string {
  return `\`${text}\``;
}
