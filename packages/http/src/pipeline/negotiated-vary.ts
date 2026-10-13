/**
 * `Vary: accept` for an answer negotiated among several media types, added to the headers the
 * answer already varies on (those of its cache policy, or the ones the handler sets).
 */
export function negotiatedVary(varies: boolean, vary: string | undefined): Record<string, string> {
  if (!varies) {
    return {};
  }

  const names = (vary ?? '').split(',').map((name) => name.trim().toLowerCase());

  if (vary === undefined || vary.trim() === '') {
    return { vary: 'accept' };
  }

  return names.includes('accept') || names.includes('*') ? {} : { vary: `${vary}, accept` };
}
