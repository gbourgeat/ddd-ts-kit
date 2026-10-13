[English](bootstrap-with-well-designed-contexts.md) · **Français**
<!-- translation-of: bootstrap-with-well-designed-contexts.md sha256:8212ed83d1f5404d -->

# Démarrer avec des contextes bien conçus

**Résumé.** Un sous-domaine générique est un sous-domaine dont toute application de son genre a
besoin et avec lequel aucune ne gagne : qui sont les utilisateurs, à quelles organisations ils
appartiennent, ce qu'ils peuvent y faire. Le concevoir de nouveau dans chaque projet coûte des
semaines, et c'est là que se concentrent les premières erreurs d'un projet (une table de mots de
passe, des rôles en chaînes libres, un identifiant de *tenant* pris dans la requête HTTP). Un
*preset* du kit écrit un tel contexte en entier, dans les conventions du kit, pour que l'équipe
consacre plutôt ses premières semaines au cœur. Ce guide dit ce qu'écrit le *preset* `identity`,
ce qu'il demande à la *stack* et pourquoi, comment il se compose avec chaque modèle d'accès et
avec les *tenants*, et quoi faire une fois qu'il est là. Quels autres contextes méritent un
*preset* est pesé dans [Presets de contextes](../proposals/context-presets.fr.md).

## Quand en utiliser un

Utilisez un *preset* quand le contexte est classé `generic` dans `docs/architecture/contexts.md`
(voir [Domaine et sous-domaines](../concepts/domain-and-subdomains.fr.md)) et que son langage est
celui que parle le *preset*. Ne l'utilisez pas pour un contexte qui n'a que l'air générique : le
contexte d'identité de l'exemple
([`examples/scheduling`](../../examples/scheduling/src/contexts/identity/CONTEXT.md)) est
`supporting`, puisque ses délégations sont données par un praticien à un assistant sur un seul
bureau, et que les cabinets vivent dans un fuseau horaire. Un *preset* y devrait être tordu
jusqu'à ne plus être le *preset* ; les générateurs sont le meilleur point de départ.

Un *preset* est écrit une fois. Dès lors, ses fichiers sont le code du projet : rien dans la
configuration ne s'en souvient, et les changer revient à changer n'importe quel autre contexte.

## L'écrire

```bash
npx ddd-ts-kit init --preset identity                     # déclare le contexte identity, generic
npx ddd-ts-kit generate context people --preset identity  # dans un projet existant, sous un autre nom
```

Sur `init`, le *preset* écrit le contexte de son nom, `identity`, déclaré `generic` sauf si un
`--context identity:<classification>` dit autre chose. Sur `generate context`, il écrit dans le
contexte nommé, avec la classification et l'objet du *preset* sauf si `--classification` ou
`--purpose` disent autre chose. Dans les deux cas, il exécute les générateurs du kit pour ce
qu'ils câblent hors du contexte (les tables de la plateforme, le langage publié, les registres,
les événements audités), puis dispose les fichiers auxquels ces générateurs continuent d'ajouter.

Un projet contient un seul contexte écrit depuis un *preset* d'un même genre : deux contextes
d'identité déclareraient les mêmes événements d'intégration et les mêmes tables dans les fichiers
de la plateforme (les événements audités, le schéma), qui ne compilent pas ensemble.
`generate context --preset` en refuse un second, en nommant le contexte qui contient le premier,
et `init` n'écrit qu'une fois un *preset* nommé deux fois.

Le résultat est vert tel quel : aucun constat de `check`, d'ESLint, de dependency-cruiser et de
knip, un formatage propre, typé, et ses *specs* passent, unitaires et d'intégration (les
adaptateurs de l'ORM contre PostgreSQL en processus). Les *specs* de bout en bout le prouvent sur
quatre *stacks* : des rôles sur Drizzle et Zod ; des relations sur Knex et class-validator avec
des *tenants* et Keycloak ; des politiques par attributs sur Fastify avec des *tenants* et un
vérificateur JWT (`packages/cli/test/e2e/preset-identity.spec.ts`) ; et généré dans un projet qui
existe et décide avec OpenFGA (`preset-identity-generated.spec.ts`).

## Ce qu'il écrit

| Partie | Quoi |
|---|---|
| Comptes | un compte par personne, sous le sujet que lui donne son fournisseur d'identité (`actor.id`) : provisionné à la première connexion à partir de ce que dit son jeton (`PUT /accounts/me`), rafraîchi à chaque connexion suivante, désactivé par son propriétaire (`POST /accounts/me/deactivation`). Aucun mot de passe, aucun secret du fournisseur. L'adresse électronique est toujours celle du jeton, et une adresse que le fournisseur a vérifiée (`email_verified`, lu comme l'attribut d'acteur `emailVerified` ; `EMAIL_NOT_VERIFIED` sinon), puisque les invitations sont rapprochées par elle. Un compte désactivé quitte chaque organisation et met fin à chaque délégation dans la même unité de travail ; le dernier propriétaire d'une organisation nomme d'abord un autre propriétaire (`LAST_OWNER`) |
| Organisations | ouvertes sous un *slug* qui est leur identité pour toujours (`POST /organisations`) ; celui qui l'ouvre en est le premier propriétaire. Avec des *tenants*, une organisation est un *tenant* et son *slug* l'identifiant du *tenant* |
| Membres | un rôle chacun, du vocabulaire `MemberRole` (`owner`, `admin`, `member`) ; ce qu'accorde un rôle est une seule table, `RoleRightsService` (`PUT /organisations/:organisationId/members/:accountId/role`, `DELETE` du membre). Personne ne change son propre rôle (`OWN_ROLE`), et personne ne nomme, n'invite, ne change ni ne retire quelqu'un au-dessus de son propre rôle (`ABOVE_OWN_ROLE`, `OWNERS_ONLY` pour un propriétaire). Une organisation garde au moins un propriétaire : chaque changement d'un membre enregistre l'organisation avec lui, pour que sa version ordonne les changements de ses propriétaires et que deux propriétaires qui se retirent l'un l'autre au même moment ne puissent pas valider tous les deux |
| Invitations | émises vers une adresse électronique dans un rôle pour sept jours (`POST /organisations/:organisationId/invitations`) ; le jeton est renvoyé une seule fois et seule son empreinte SHA-256 est gardée ; acceptées ou déclinées une fois connecté, avec l'adresse à laquelle elles ont été envoyées (`POST /invitations/acceptance`, `/invitations/declination`) ; révoquées par qui peut inviter |
| Délégations | un membre prête certains droits de son rôle à un autre membre pour quatre-vingt-dix jours au plus (`POST /organisations/:organisationId/delegations`, `DELETE` pour révoquer) ; jamais plus que le rôle du délégant, jamais ce qui lui a été prêté, jamais le pouvoir d'agir au-dessus du propre rôle du délégué ; terminées quand l'un des deux membres part ou que le délégant change de rôle. Un changement décidé sous une délégation la nomme dans son fait (`delegationId` de `member.role-changed`, de `member.removed` et de l'invitation émise) |
| Recherche | les membres d'une organisation, paginés, restreints à ce que l'acteur peut lire (`GET /organisations/:organisationId/members`) |
| Autorisation | `identityPermissions`, sept politiques sur `OrganisationRights` (les droits de l'acteur dans une organisation : son rôle et ce que lui prêtent les délégations actives) |
| Langage publié | `organisation.opened`, `member.joined`, `member.role-changed`, `member.removed`, `delegation.granted`, `delegation.revoked`, `account.deactivated`, par l'outbox |
| Fournisseur d'identité | le port `IdentityProviderAdmin`, tenu à jour par quatre consommateurs des faits publiés, livrés au moins une fois (organisation connue, membre ajouté ou retiré, compte désactivé), avec un *fake* en mémoire et `KeycloakIdentityProviderAdmin`, une recette pour Keycloak 26 ou plus récent |
| Adaptateurs | des *repositories* Knex ou Drizzle, des *mappers*, des tables et le lecteur de recherche, chacun avec sa *spec* de contrat |
| Tests | des *builders*, des *fakes*, des *specs* unitaires du modèle et de chaque gestionnaire et contrôleur, les *specs* de contrat des *repositories*, la *spec* de l'adaptateur Keycloak contre un serveur HTTP local |
| Documentation | l'objet, la classification, le glossaire et une section `## Design` dans `CONTEXT.md` ; avec des *tenants*, un enregistrement de décision |

## Ce qu'il demande à la *stack*

Le *preset* est écrit pour les valeurs par défaut d'`init` et leurs variantes les plus proches.
Une autre *stack* est refusée avant que rien ne soit écrit, avec l'option qui conviendrait :

| Clé | Acceptée | Pourquoi |
|---|---|---|
| `stack.style` | `declared` | les cas d'usage, les politiques et les adaptateurs se déclarent eux-mêmes ; un module explicite serait une seconde copie du contexte à tenir |
| `stack.dependencies` | `signature` | les classes disent ce dont elles ont besoin par leur constructeur |
| `stack.refusals` | `factories` | les refus sont des fabriques statiques d'une classe par concept |
| `stack.valueObjects` | `throwing` | les objets-valeurs refusent une valeur invalide quand on les construit |
| `stack.routes` | `controllers` | une classe de contrôleur par route |
| `stack.orm` | `knex`, `drizzle` | les deux adaptateurs écrits ; Prisma et TypeORM ne le sont pas |
| `stack.validation` | `zod`, `class-validator` | les deux familles de schémas de requête HTTP écrites |
| `stack.schemas` | `shared`, `per-route` | partagés : les réponses par identifiant sont l'`Accepted` de `@ddd-ts-kit/http` et le jeton d'une invitation un schéma de `presentation/http/shared/` ; par route : chaque route garde le sien |
| `stack.http` | `express`, `fastify` | les routes NestJS s'écrivent autrement |
| `stack.authn` | `jwt`, `keycloak` | un compte est le sujet d'un jeton : sans vérificateur, chaque appelant est anonyme et le contexte ne servirait personne |
| `stack.database` | `postgres` | les tables gardent une seule appartenance en cours par compte avec un index unique partiel (`where removed_at is null`), que MySQL n'a pas |

Prendre en charge une autre valeur revient à écrire la variante des fichiers qu'elle change
(`*.knex.ts.tpl` à côté de `*.drizzle.ts.tpl` sous `packages/cli/templates/presets/identity/`,
plusieurs variantes à la suite quand un fichier dépend de plusieurs clés :
`*.class-validator.per-route.ts.tpl`), pas à changer le modèle.

## Modèles d'accès et *tenants*

Chaque cas d'usage exige une permission d'`identityPermissions`, et chaque personne connectée les
détient quoi que dise `--authz` : le *preset* écrit l'attribution `'identity:*'` dans
`platform/auth/signed-in-grants.ts` et enveloppe le modèle de `createAuthorizer` dans
`SignedInGrantsAuthorizer` de `@ddd-ts-kit/auth`, qui répond à ces attributions avant le modèle.
Les systèmes, les services et les appelants anonymes n'en reçoivent rien. À l'intérieur d'une
organisation, ce sont les politiques du contexte qui décident, sur les droits que l'acteur y
détient. Les mêmes fichiers servent donc :

| `--authz` | Ce qui décide à l'intérieur d'une organisation | Ce que les autres contextes font des événements |
|---|---|---|
| `rbac` | les politiques, sur le rôle dans l'organisation | rien à faire : les rôles du jeton restent les rôles de la plateforme |
| `abac` | les politiques ; les règles d'`attribute-policies.ts` décident toujours des autres contextes | lire le rôle comme un attribut si une règle en a besoin |
| `rebac` | les politiques | écrire les tuples de leur propre modèle à partir de `member.joined`, `member.role-changed`, `member.removed`, `delegation.*` |
| OpenFGA | les politiques | les mêmes tuples, écrits dans OpenFGA par `@ddd-ts-kit/openfga` |
| `custom` | les politiques | selon les besoins de l'adaptateur du projet |

Un `createAuthorizer` que l'équipe a réécrit est laissé tel quel ; le générateur dit alors, comme
étape suivante, comment l'envelopper.

Avec `--tenancy shared-table`, une organisation est un *tenant* : les *publishers* donnent à
chaque événement l'organisation comme *tenant*, pour que les consommateurs des autres contextes
s'y exécutent. Les tables du contexte d'identité n'appartiennent à aucun *tenant*, puisqu'elles
décident qui appartient à quoi : elles sont le plan de contrôle des *tenants*, lues à travers eux
sous un enregistrement de décision que le *preset* écrit
(`docs/adr/NNNN-identity-is-the-control-plane-of-the-tenants.md`), vers lequel pointent les
désactivations de `tenancy/scoped-statement`. Voir [Multitenance](../concepts/multitenancy.fr.md).

Le jeton dit à quelles organisations une personne appartient, pour que chaque autre contexte en
tire son *tenant*. Avec `--authn keycloak`, le *preset* pose `tenantClaim: 'organization'` dans
`createAuthenticator` : Keycloak écrit le *claim* `organization` des organisations que
l'adaptateur du fournisseur tient à jour (le *client scope* `organization` ajouté au client). Une
personne d'une seule organisation y travaille à chaque requête HTTP ; une personne de plusieurs
les détient comme l'attribut `tenants`, et chaque requête HTTP nomme celle dans laquelle elle
travaille avec `x-tenant-id` (refusée par un 403 si elle n'en est pas membre, `tenantFromHeader`
puis `tenantFromClaim` dans `resolveTenant`). Retirée d'une organisation, elle la perd à son
prochain jeton, et le contexte d'identité lui refuse déjà ses cas d'usage. Avec `--authn jwt`, le
*preset* laisse une étape suivante : faire correspondre le *claim* qu'écrit votre fournisseur
(`tenantClaim` quand c'est une liste ou un objet indexé par organisation, `toActor` sinon).

## Le fournisseur d'identité

![Une personne se connecte auprès du fournisseur d'identité, dont le jeton donne à la bordure de l'API l'acteur et ses tenants ; le contexte d'identité décide des comptes, des organisations, des membres, des invitations et des délégations ; ses faits sortent par l'outbox, quatre consommateurs alignent le fournisseur par IdentityProviderAdmin au moins une fois, et les autres contextes construisent leurs propres tuples et tenants à partir des mêmes faits](../assets/diagrams/bootstrap-with-well-designed-contexts-identity-loop.fr.svg)

Le fournisseur authentifie, le contexte autorise ([Identité](../tools/identity.fr.md)). Le
fournisseur suit les décisions du contexte par quatre consommateurs de ses propres faits publiés
(`application/integration/handlers/`) : livrés par l'outbox, au moins une fois, si bien qu'un
fournisseur indisponible quand un membre est retiré ou un compte désactivé est sollicité de
nouveau par le relais ou le *broker* jusqu'à ce qu'il réponde, et la révocation n'est jamais
perdue. Ils arrivent sans ordre garanti, donc chaque consommateur aligne le fournisseur sur ce
que le contexte contient maintenant (une nouvelle tentative tardive de `member.joined` pour un
membre retiré depuis le retire de nouveau), et chaque méthode du port est idempotente.

`KeycloakIdentityProviderAdmin` est une recette pour l'API d'administration de Keycloak 26 ou
plus récent, le *realm* ayant les organisations activées, en tant que client confidentiel qui
détient les rôles `manage-users` et `manage-realm` de `realm-management` (les points d'accès des
organisations demandent le second). Il lit `KEYCLOAK_URL`, `KEYCLOAK_REALM`,
`IDENTITY_PROVIDER_ADMIN_CLIENT_ID` et `IDENTITY_PROVIDER_ADMIN_CLIENT_SECRET` au moment d'un
appel, si bien qu'un projet qui ne s'en sert pas démarre sans eux.

Un autre fournisseur (Zitadel, Auth0, Entra ID) est un autre adaptateur du même port : quatre
méthodes (`openOrganisation`, `addMember`, `removeMember`, `disableAccount`), sa *spec* exécutée
contre un serveur HTTP local comme l'est celle de Keycloak, déclaré
`@Adapter(IdentityProviderAdmin)` à la place de celui de Keycloak. Un fournisseur qui n'a besoin
de rien de l'application reçoit un adaptateur dont les méthodes ne font rien, ce que dit le
commentaire de sa classe.

L'adaptateur Keycloak est spécifié contre les chemins et les corps de la documentation de
Keycloak 26 par un serveur local ; le *pipeline* du kit ne l'exécute pas contre un vrai Keycloak.
Il a été exécuté une fois à la main contre Keycloak 26.8.0 (2026-10-13) : chaque méthode, chacune
deux fois, a fait ce qu'elle dit, un utilisateur désactivé a gardé son profil, et cette exécution
a corrigé la recherche d'une organisation, que Keycloak trouve par son nom et non par son alias,
si bien que l'adaptateur lit ses pages. Avant de vous y fier, exécutez-le une fois contre votre
*realm* : démarrez Keycloak (`npm run infra:up` avec `--authn keycloak`), activez les
organisations dans le *realm*, créez le client confidentiel avec les deux rôles, puis appelez
chaque méthode depuis un script et lisez le résultat dans la console d'administration
(l'organisation et ses membres, l'utilisateur désactivé avec les attributs de son profil
gardés).

## Une fois qu'il est écrit

1. Lisez la section `## Design` de son `CONTEXT.md`, puis l'enregistrement de décision s'il y en
   a un.
2. Ajustez le vocabulaire `MemberRole` et la table de `RoleRightsService` aux rôles que nomme le
   métier ; les politiques lisent des droits, pas des rôles, et ne changent pas.
3. Remettez le jeton d'invitation : la réponse de la route le contient une seule fois, et seule
   son empreinte est gardée, si bien qu'aucun événement ne le porte. Le client envoie le lien ;
   ou, pour que l'application écrive elle-même le courriel, `InviteMemberHandler` confie le jeton
   à un port à vous (une *gateway* de courriel) là où il l'émet.
4. Donnez aux autres contextes ce dont ils ont besoin du langage publié, par
   `generate integration-handler`.
5. Lancez `npm run verify` et validez le contexte en un seul changement : il est vert tel
   qu'écrit.

## Voir aussi

- [Presets de contextes](../proposals/context-presets.fr.md) : quels autres contextes en méritent un
- [Choisir le contrôle d'accès](choosing-access-control.fr.md)
- [Domaine et sous-domaines](../concepts/domain-and-subdomains.fr.md)
- [Quelle commande, quand](commands.fr.md)
