node_modules
dist
/coverage/
.env
*.tsbuildinfo
.ddd-ts-kit/
.eslintcache/
.worktrees/
{{#if orm.prisma}}
generated
{{/if}}
{{#if files.local}}
.data/
{{/if}}
