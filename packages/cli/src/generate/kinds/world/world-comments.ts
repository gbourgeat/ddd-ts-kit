/**
 * The comments the generator writes about the arrangement of a spec or of a world, beside its
 * `TODO` markers: written from here, and recognised from here by `isWorldComment`.
 */
export const WORLD_COMMENTS = {
  absent: (command: string): string =>
    `\`${command}\` shortens this: the specs generated after it arrange through the world.`,
  unread: (context: string, looksFor: string): string =>
    `The world of ${context} could not be read by the generator (it looks for ${looksFor}): this spec arranges itself.`,
  lacking: (context: string, missing: string, command: string): string =>
    `The world of ${context} ${missing}: \`${command} --force\` writes it again.`,
  replacing: (): string => 'The fakes a spec hands replace those the world builds for the same port.',
} as const;
