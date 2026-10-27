/** The marketplace of the plugin of the kit, as `strictKnownMarketplaces` names a GitHub marketplace. */
const MARKETPLACE = { source: 'github', repo: 'gbourgeat/ddd-ts-kit' };

/**
 * The block the platform team pastes in the managed settings of Claude Code: what a project file
 * cannot set, with the keys of its managed settings reference (read on 2026-10-23).
 */
export function managedSettingsNote(): string {
  const block = {
    allowManagedHooksOnly: true,
    allowManagedPermissionRulesOnly: true,
    permissions: { disableBypassPermissionsMode: 'disable' },
    strictKnownMarketplaces: [MARKETPLACE],
    requiredMinimumVersion: '<the oldest version of Claude Code the team accepts>',
  };

  return [
    'The regulated profile holds in the managed settings of Claude Code what a project file cannot set; paste this block there (managed-settings.json, deployed by the platform team), with the version your team accepts, and the marketplace of your mirror of the plugin when you keep one:',
    JSON.stringify(block, null, 2),
    'With allowManagedHooksOnly, copy the hooks of .claude/settings.json into the managed settings too: the project file alone no longer runs them.',
    'The permissions.allow rules of .claude/settings.json apply only in a workspace trusted on the machine that runs the session; a headless run (claude -p) in an untrusted workspace ignores them, prints "Ignoring N permissions.allow entries" on stderr, and keeps the deny and ask rules. Trust the workspace by opening it once in Claude Code and accepting the dialog, or set projects["<repository root>"].hasTrustDialogAccepted to true in ~/.claude.json of the account that runs it (the platform team manages that account); a git worktree uses the trust of its main checkout.',
  ].join('\n');
}
