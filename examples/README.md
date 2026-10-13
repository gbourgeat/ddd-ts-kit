**English** · [Français](README.fr.md)

# Examples

[scheduling](scheduling/README.md) is an appointment scheduling platform for practices, built
with the kit from a one-page statement of needs: the strategic steps of the method, one `init`
command, four bounded contexts built slice by slice by parallel workers, relationship-based
authorization combined with roles, one trace per booking across contexts, and a recorded run
against Keycloak, PostgreSQL, Dragonfly, Jaeger and GlitchTip. It comes with an honest
measurement of how the tooling behaved: [scheduling/docs/tooling-report.md](scheduling/docs/tooling-report.md).
From the root of the repository: `npm ci && npm run build && npm run example:verify`.
