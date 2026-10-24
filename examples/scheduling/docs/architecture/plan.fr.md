[English](plan.md) · **Français**
<!-- translation-of: plan.md sha256:c1df1a7412bc81b6 -->

# Plan d'architecture

Next: done

La ligne `Next:` ci-dessus est lue par les outils au début de chaque session : gardez-la sur une
ligne, `Next: <step number> <skill> - <first thing to do>`, et `Next: done` à la fin.

## Besoins

Exprimés par le *product owner* le 2026-10-10 : voir [needs.fr.md](needs.fr.md), mot pour mot. En
une ligne : une plateforme de prise de rendez-vous pour des cabinets (disponibilités, réservation
sans double occupation, la vie d'un rendez-vous, une liste d'attente, la délégation à des
assistants, chaque cabinet gardé à part, notifications et rappels, chiffres d'occupation, support
au nom des utilisateurs, responsabilité).

## Étapes

| # | Étape | Artefact | Statut |
|---|---|---|---|
| 1 | Découvrir le domaine | `docs/architecture/discovery.md` | done |
| 2 | Trouver les contextes délimités | `docs/architecture/contexts.md` | done |
| 3 | Écrire les glossaires | `docs/architecture/glossary.md`, puis chaque `CONTEXT.md` | done |
| 4 | Dessiner la carte des contextes | `docs/architecture/context-map.md`, puis `docs/context-map.md` | done |
| 5 | Choisir la *stack* et amorcer | `ddd-ts-kit.config.json`, le projet | done |
| 6 | Planifier les tranches | `docs/architecture/slices.md` | done |
| 7 | Construire | le code, un *commit* par tranche | done, avec ce que `docs/tooling-report.md` liste comme non construit |

Le statut vaut `todo`, `in progress`, `done` ou `skipped` (avec la raison sous Décisions).

Le glossaire et l'ébauche de carte des étapes 3 et 4 ont été consommés par l'amorçage, comme le
dit la méthode ; des copies figées sont dans `before-bootstrap/` pour que le chemin puisse être
rejoué.

## Décisions

Une ligne chacune : `<date> <what was decided>: <why> (<who decided>)`. Une décision qui contraint
le code devient ensuite un enregistrement dans `docs/adr/` une fois le projet existant.

- 2026-10-10 quatre contextes, `scheduling` (cœur), `identity`, `notification`, `analytics` (de soutien) : un langage et un propriétaire chacun, argumenté dans `contexts.md` (*product owner*).
- 2026-10-10 le journal d'audit est une capacité de la plateforme, pas un contexte : ni langage, ni décision propre (*product owner*, sur proposition du chef d'orchestre).
- 2026-10-10 le cabinet est l'unité gardée à part ; pas de niveau organisation : absent des besoins (*product owner* ; point chaud gardé dans `discovery.md`).
- 2026-10-10 les disponibilités, les rendez-vous et la liste d'attente restent dans un seul contexte : un créneau libre doit être vrai au même instant que ce qui occupe le calendrier (*product owner*).
- 2026-10-10 relations : `scheduling` depuis `identity` en client-fournisseur, `notification` depuis `scheduling` et `identity` en langage publié, `analytics` depuis `scheduling` en conformiste ; aucun cycle (*product owner*).
- 2026-10-10 `scheduling` lit `identity` deux fois, une de chaque façon : une projection des praticiens (décide et libelle les listes) et une *gateway* pour le nom affiché du patient sur une vue de détail (rare, à jour, les données personnelles restent chez leur propriétaire) (chef d'orchestre, approuvé).
- 2026-10-10 les délégations ne voyagent pas comme des données copiées : `identity` écrit la relation sur le poste du praticien, `scheduling` relie les calendriers aux postes, le modèle d'autorisation les joint (chef d'orchestre, approuvé).
- 2026-10-10 *stack*, choix du propriétaire : Express ; class-validator ; tsyringe dans le style déclaré avec le *barrel* ; Knex sur PostgreSQL ; outbox ; un serveur au protocole Redis (Dragonfly) comme cache, verrou, limiteur de débit et *broker* d'événements (Redis Streams) : un seul serveur à maintenir en vie au lieu de deux ; Keycloak ; relations combinées aux rôles (ADR 0001) ; journal d'audit activé ; protocole Sentry (GlitchTip en local) ; pino ; les deux *pipelines* (*product owner*).
- 2026-10-10 commande d'amorçage, mot pour mot : `npx ddd-ts-kit init --http express --validation class-validator --di tsyringe --style declared --assembly barrel --orm knex --database postgres --events outbox --broker redis --cache redis --authn keycloak --authz rebac --audit on --errors sentry --logger pino --docs-ui swagger --ci both --json` (dans ce dépôt, la CLI est `node ../../packages/cli/dist/bin.js`, lancée depuis `examples/scheduling`).
- 2026-10-10 le chevauchement des rendez-vous est décidé deux fois : par le domaine pour la réponse métier, par une contrainte d'exclusion PostgreSQL pour la concurrence ; le verrou Redis n'est pas utilisé pour cela (fiable au mieux seulement, voir le README de `@ddd-ts-kit/redis`) (chef d'orchestre, approuvé).
- 2026-10-10 une offre de la liste d'attente est un rendez-vous demandé avec une échéance courte : la réservation temporaire, son expiration et la garantie contre le chevauchement sont celles des rendez-vous (chef d'orchestre).
- 2026-10-10 construction en parallèle : le *worker* de la plateforme et trois *workers* de contexte à la fois, partageant un seul arbre (pas de git ici), chacun dans son dossier ; `scheduling` partagé entre deux *workers* sur des agrégats différents (chef d'orchestre ; résultat dans `docs/tooling-report.md`).
- 2026-10-10 le travail planifié tourne dans un processus *worker* (`src/apps/worker/main.ts`), pas dans l'API (*product owner*).
- 2026-10-10, après la livraison : `analytics` garde une ligne par fait (l'issue de chaque rendez-vous) et calcule l'occupation à la lecture, dans la base de données ; l'occupation stockée, sa vérification nocturne et son *job* sont retirés : un compteur tenu par des événements doit être défendu contre l'ordre et réparé, un chiffre calculé à partir des faits ne peut pas dériver (*product owner* ; `slices.md`, notes de M1.35 et M1.37).

- 2026-10-24 un effacement atteint chaque copie d'une personne, pas seulement les paroles scellées : `identity` oublie la personne, `notification` son contact, `scheduling` les notes, les motifs d'annulation et les documents de ses rendez-vous et le nom que son annuaire avait copié ; les rendez-vous restent comme des faits avec un identifiant opaque ; ce qui a été publié avant est hors d'atteinte et le README le dit (product owner, sur la proposition `privacy-by-design` du kit).

## Questions ouvertes

Une ligne chacune, avec qui peut répondre. Une question ne bloque que l'étape qui a besoin de sa
réponse.

- Une organisation regroupe-t-elle plusieurs cabinets ? *Product owner*. Ne bloque rien de ce qui est construit ici.
- Un patient peut-il déplacer un rendez-vous dans les 24 heures ? Considéré comme non. *Product owner*.
- Une absence compte-t-elle dans la limite du patient ? *Product owner*.
