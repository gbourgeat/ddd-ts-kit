import type { Config } from '../config';

const FORMS_WITHOUT_HTTP =
  'Kept `forms: on` with `http: none`: no route serves a form until an HTTP framework is chosen (`init --force --http <framework>`); `--forms off` records the choice.';

/** What init kept on a combination its defaults would not choose, said in a note so that exit code 0 hides nothing. */
export function keptCombinationNotes(config: Config): string[] {
  const { audit, orm, forms, http } = config.stack;

  return [
    ...(audit === 'on' && orm === 'none' ? [auditWithoutOrm(config.platformDir)] : []),
    ...(forms === 'on' && http === 'none' ? [FORMS_WITHOUT_HTTP] : []),
  ];
}

function auditWithoutOrm(platformDir: string): string {
  return `Kept \`audit: on\` with \`orm: none\`: the entries of the audit trail live in the memory of the process and are lost when it stops, until ${platformDir}/audit/create-audit.ts answers its TODO(platform) with an adapter of your storage; \`--audit off\` leaves the trail out.`;
}
