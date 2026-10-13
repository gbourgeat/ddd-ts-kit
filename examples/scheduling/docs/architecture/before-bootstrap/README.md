**English** · [Français](README.fr.md)

# Artefacts consumed by the bootstrap

The method writes the glossary and the draft of the context map before the project exists, then
turns them into `generate context` arguments and deletes them: their content lives afterwards in
each `CONTEXT.md`, in `ddd-ts-kit.config.json` and in `docs/context-map.md`, and a second copy
would drift. They are kept here, frozen, for one reason only: this project is an example, and a
reader must be able to replay the path from `../needs.md`. Do not update them.
