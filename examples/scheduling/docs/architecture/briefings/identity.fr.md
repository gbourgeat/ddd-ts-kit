[English](identity.md) · **Français**
<!-- translation-of: identity.md sha256:beabc55e9f9b6e84 -->

# Consigne : identity

Vous construisez le contexte délimité `identity` de l'exemple scheduling. Nom du *worker* : `identity`.

Périmètre
- Vous pouvez écrire : `src/contexts/identity/**` et `test/e2e/identity-*.e2e.spec.ts`.
- Générateurs que vous pouvez lancer : value-object, entity, domain-event, error, domain-service,
  command, query, route, port, adapter, event-handler, builder, e2e.

Tranches, dans cet ordre (lignes de `docs/architecture/slices.md`, règles sous son tableau) : 11, 12,
13, 14, 15, 16, 17. Les agrégats `Person`, `Practice` (ses membres en font partie) et `Delegation`
existent avec leurs *repositories* ; les événements d'intégration de la ligne 4 existent avec leur
contenu décidé (en lecture seule pour vous : `src/contexts/identity/published-language/*.payload.ts` ;
remplissez leurs *publishers* et les événements du domaine qui sont derrière). `ExpireDelegations`
et son *job* existent, non remplis.

Contrats que vous possédez et devez honorer : les contenus ci-dessus, et `PersonDirectoryContract`
(`published-language/person-directory.contract.ts`), que `scheduling` appelle par une *gateway* :
donnez-lui une implémentation qui lit vos tables, trouvez la forme que le *checker* accepte, et
dites dans votre rapport ce que le chef d'orchestre doit lier dans `src/platform/platform.module.ts`.

Terminé quand : chaque tranche est construite et testée (domaine, gestionnaires, adaptateurs,
routes), aucun marqueur ne reste dans votre contexte, eslint, vitest et check sont propres sur
votre dossier. Suivez `docs/architecture/briefings/README.md` pour les règles communes et le
rapport.
