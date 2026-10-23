**The guide of the plugin says what holds each skill.** A new section of
`docs/guides/coding-agents.md`, "What holds each skill", names for each of the twenty-three skills
the deterministic control behind it (the rule ids of `ddd-ts-kit rules`, the gates of the guard,
the checks of the pipeline) and the gap where there is one, as the AI-native SDLC playbook of
Anthropic asks of advisory skills. A test of the plugin, `node --test plugin/skills/controls.test.mjs`
(run by `npm run ci:arch`), fails when a rule id of the table is unknown to the CLI or when a skill
has no row, so the table cannot drift.
