[English](0003-a-practice-is-not-a-tenant.md) · **Français**
<!-- translation-of: 0003-a-practice-is-not-a-tenant.md sha256:0269dd45b6a8f29d -->

# ADR-0003 : un cabinet n'est pas un *tenant*

- Statut : proposé (en attente de la décision du propriétaire du kit)
- Date : 2026-10-13

Le propriétaire a demandé que la stratégie de *tenant* de cette application soit rendue explicite
et imposée. Cet enregistrement propose à la place que l'application n'ait pas de multitenance ; il
n'est pas accepté tant que le propriétaire n'a pas tranché entre lui et la seconde alternative
ci-dessous (un réseau comme *tenant*, imposé sur des tables partagées), qui suit la demande telle
qu'elle a été formulée.

## Contexte

Le kit offre des stratégies de multitenance (`"stack.tenancy"` : tables partagées avec une colonne
de *tenant*, sécurité au niveau des lignes, un schéma ou une base de données par *tenant*), dans
lesquelles chaque instruction d'un *repository* est confinée au *tenant* du travail, et un appelant
hors de tout *tenant* est refusé en bordure. Les données de cette application sont regroupées par
cabinet : calendriers, rendez-vous et postes appartiennent à un cabinet, et les jetons du realm
portent une *claim* `tenant_id`.

Un *tenant* est une frontière de stockage : aucune lecture et aucune écriture ne peut la franchir,
qui que ce soit qui demande. Un cabinet n'en est pas une ici. Un patient réserve dans plusieurs
cabinets avec un seul compte et liste ses rendez-vous à travers eux ; un praticien peut travailler
dans deux cabinets ; l'administrateur de la plateforme ouvre des cabinets. Ce qu'un utilisateur
peut atteindre dans un cabinet est une relation du modèle d'autorisation (responsable, praticien,
assistant d'un cabinet ; titulaire ou délégué d'un poste ; patient d'un rendez-vous), décidée par
élément et listée par `listAccessible`, qui restreint chaque recherche de l'application.

## Décision

L'application sert un seul client, le réseau de cabinets, et sa configuration ne dit rien de la
multitenance (`"stack.tenancy"` absent, lu comme `none`). La frontière entre cabinets est imposée
par le modèle d'autorisation, élément par élément : aucun cas d'usage n'atteint un élément sans une
relation avec lui ou un rôle qui l'accorde (ADR-0001), et aucune recherche ne renvoie un élément
hors du périmètre de l'acteur. La *claim* `tenant_id` garde son rôle dans le journal d'audit (une
chaîne par *tenant* de l'acteur) et dans les champs du journal.

## Conséquences

- Plus simple : un patient et un praticien travaillent à travers les cabinets avec une seule
  session, et aucune requête HTTP n'a besoin de nommer un cabinet pour atteindre ses propres
  rendez-vous.
- Plus difficile : l'isolement entre cabinets repose sur le modèle d'autorisation et sur les
  recherches restreintes, pas sur le stockage. Une instruction de *repository* sans périmètre
  traverserait les cabinets ; ce sont les *specs* des gestionnaires et les ports de lecture
  restreints qui le tiennent.
- À reconsidérer : si l'application est vendue à plusieurs réseaux indépendants, chaque réseau
  devient un *tenant* (`init --tenancy shared-table`, les *repositories* passant par
  `tenantTable`), et les cabinets restent des relations à l'intérieur.

## Alternatives envisagées

- **Chaque cabinet comme *tenant* sur des tables partagées.** Chaque instruction confinée à un
  cabinet, une discordance refusée en bordure. Refusée : la liste des rendez-vous d'un patient
  s'étend sur plusieurs cabinets, et un praticien de deux cabinets aurait besoin de deux sessions ;
  le modèle de relations décide déjà par élément ce qu'une frontière de *tenant* déciderait par
  ligne.
- **Un réseau comme *tenant* dès maintenant.** Ce que le propriétaire a demandé :
  `"stack.tenancy": "shared-table"`, une colonne `tenant_id` sur chaque table des contextes, chaque
  *repository* passant par `tenantTable` et `ownTenantTable`, l'outbox et les modèles de lecture
  gardant le *tenant*, `tenancy/scoped-statement` jugeant les adaptateurs, et les cabinets gardés
  comme relations à l'intérieur du réseau. Inoffensif avec un seul réseau, au prix d'une colonne et
  d'une condition sur chaque table, et d'une *claim* du jeton qui nomme le réseau plutôt que le
  cabinet qu'elle nomme aujourd'hui.
