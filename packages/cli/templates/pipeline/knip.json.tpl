{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
    "scripts/*.ts"{{knip.e2eEntry}}{{knip.toolEntry}}{{knip.appsEntry}}
  ],
  "project": ["{{config.sourceRoot}}/**/*.ts", "scripts/**/*.ts"{{knip.e2eProject}}{{#if orm.prisma}}, "prisma/**/*.prisma"{{/if}}],
{{#if knip.ignores}}
  "ignoreDependencies": {{knip.ignored}},
{{/if}}
  "ignoreExportsUsedInFile": true,
  "mcp": false,
{{#if refusals.named}}
  "ignoreIssues": {
    "{{config.contextsDir}}/*/*.codes.ts": ["types"]
  },
{{/if}}
  "{{knip.runner}}": {
    "config": [{{knip.runnerConfigs}}],
    "entry": [
      "{{config.sourceRoot}}/**/*.spec.ts",
      "{{config.contextsDir}}/*/test/fakes/*.ts",
      "{{config.contextsDir}}/*/test/worlds/*.ts",
      "test/architecture/**/*.spec.ts"{{knip.e2eSpecs}}{{knip.testDatabase}}
    ]
  }
}
