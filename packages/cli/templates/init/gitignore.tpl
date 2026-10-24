node_modules
dist
/coverage/
.env
*.tsbuildinfo
.ddd-ts-kit/
.eslintcache/
.worktrees/
.stryker-tmp/
/reports/mutation/
{{#if orm.prisma}}
generated
{{/if}}
{{#if files.local}}
.data/
{{/if}}
