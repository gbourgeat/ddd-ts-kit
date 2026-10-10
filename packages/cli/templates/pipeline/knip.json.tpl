{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
{{#if style.explicit}}
    "{{config.contextsDir}}/*/*.module.ts",
{{/if}}
{{#if assembly.discovery}}
    "{{config.contextsDir}}/*/{application,infrastructure}/**/*.{{knip.discovered}}.ts",
{{/if}}
    "{{config.contextsDir}}/*/published-language/index.ts",
    "{{config.contextsDir}}/*/test/fakes/*.ts",
{{#if knip.apps}}
    "{{config.sourceRoot}}/apps/*/main.ts",
{{/if}}
    "scripts/*.ts"{{knip.e2eEntry}}
  ],
  "project": ["{{config.sourceRoot}}/**/*.ts", "scripts/**/*.ts"{{knip.e2eProject}}],
{{#if ci.gitlab}}
  "ignoreDependencies": ["eslint-formatter-gitlab"],
{{/if}}
  "ignoreExportsUsedInFile": true,
  "vitest": {
    "config": ["vitest.config.ts"{{knip.e2eConfig}}],
    "entry": ["{{config.sourceRoot}}/**/*.spec.ts", "test/architecture/**/*.spec.ts"{{knip.e2eSpecs}}]
  }
}
