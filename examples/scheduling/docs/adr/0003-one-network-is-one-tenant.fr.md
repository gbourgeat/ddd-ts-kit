[English](0003-one-network-is-one-tenant.md) · **Français**
<!-- translation-of: 0003-one-network-is-one-tenant.md sha256:67beffdebdb496ac -->

# ADR-0003 : un réseau de cabinets est un *tenant*

- Statut : accepté
- Date : 2026-10-13

## Contexte

Le propriétaire a demandé que la stratégie de multitenance de cette application soit rendue
explicite et appliquée, et que chaque règle du kit soit appliquée à l'exemple et y soit testée.
Le kit offre des stratégies de multitenance (`"stack.tenancy"` : des tables partagées avec une
colonne de *tenant*, la sécurité au niveau des lignes, un schéma ou une base par *tenant*), dans
lesquelles chaque instruction d'un *repository* est limitée au *tenant* du travail, et un
appelant extérieur à un *tenant* est refusé en bordure.

Les données de cette application sont groupées par cabinet : les agendas, les rendez-vous et les
bureaux appartiennent à un cabinet. Un cabinet n'est pourtant pas une frontière de stockage : un
patient prend rendez-vous dans plusieurs cabinets avec un seul compte et liste ses rendez-vous à
travers eux, et un praticien peut travailler dans deux cabinets. Ce qu'un utilisateur peut
atteindre dans un cabinet est une relation du modèle d'autorisation (responsable, praticien,
assistant d'un cabinet ; titulaire ou délégué d'un bureau ; patient d'un rendez-vous), décidée
élément par élément et listée par `listAccessible` (ADR-0001).

Le client de l'application est un réseau de cabinets. Vendue à plusieurs réseaux, les données
d'un réseau ne doivent jamais être lues ni changées par un autre, qui que ce soit qui le demande.

## Décision

Un réseau de cabinets est un *tenant*, sur des tables partagées (`"stack.tenancy": "shared-table"`) :

- chaque table des contextes a une colonne `tenant_id`, le réseau, et la migration
  `20261013120000_keep-the-network-of-every-row` l'ajoute à une base créée avant
  (`addTenantColumn`), en donnant les lignes déjà présentes au réseau nommé par
  `NETWORK_OF_EXISTING_ROWS` ;
- chaque *repository* et chaque modèle de lecture atteint sa table par `tenantTable` et
  `ownTenantTable` ou par l'option `tenant` de son registre, et `tenancy/scoped-statement` juge
  les adaptateurs des contextes sans aucun constat ;
- l'outbox garde le réseau de chaque événement, pour que ses consommateurs s'y exécutent ; les
  *jobs* planifiés s'exécutent une fois par réseau (`tenancy: 'per-tenant'`, les réseaux listés
  par `NETWORKS`) ; un *job* en arrière-plan s'exécute dans le réseau du travail qui l'a mis en
  file, et la file ne montre un *job* (un vidage) qu'à ce réseau ; les instances des
  gestionnaires de processus gardent le réseau du travail qui les a démarrées (`KnexProcessStore`
  avec `tenant`), et la migration donne le réseau aux instances et aux *jobs* inachevés déjà
  présents ; le journal d'audit garde une chaîne par réseau, et son côté lecture est limité au
  réseau du travail (`TenantAuditReader`) ;
- une réponse publique gardée par Varnish est étiquetée sous le réseau de la requête HTTP et
  purgée sous le réseau du travail (`cacheTags.perTenant`, `PublishedCacheInvalidation` avec
  `perTenant`), et varie sur `x-tenant-id`, qu'un appelant anonyme envoie pour nommer le réseau
  dans lequel il lit : une purge dans un réseau n'atteint jamais la copie d'un autre, et aucune
  copie n'est servie à un autre ;
- le *claim* `tenant_id` du jeton nomme le réseau de l'utilisateur ; une requête HTTP peut le
  nommer dans `x-tenant-id`, un appelant qui nomme un réseau auquel il n'appartient pas est
  refusé par un 403 avant que rien ne s'exécute, et un réseau absent de `NETWORKS` n'est pas
  trouvé (404) ;
- l'administrateur d'un réseau (`network-admin`) ouvre ses cabinets ; l'équipe de la plateforme
  (`platform-admin`) n'appartient à aucun réseau et ne lit le journal d'audit de chaque réseau que
  par une élévation (`acrossTenants`, raison `AUDIT_TRAIL_SEARCH`), que le journal enregistre
  avant que la lecture ne s'exécute.

Les cabinets restent ce qu'ils étaient : des relations du modèle d'autorisation à l'intérieur
d'un réseau. La frontière entre cabinets est décidée élément par élément, comme avant ; la
frontière entre réseaux est le stockage.

Les tables des relevés de présence gardés sous forme d'événements sont la seule exception, tant
que l'*event store* ne garde pas de *tenant* : ADR-0004.

## Conséquences

- Plus facile : un patient et un praticien travaillent toujours à travers les cabinets de leur
  réseau avec une seule session. Aucune instruction ne peut atteindre un autre réseau : oublier
  une condition est signalé par le *checker*, et l'isolement de chaque *repository* est prouvé
  par `tenantIsolationContract`.
- Plus difficile : une colonne et une condition sur chaque table ; chaque unité de travail nomme
  un réseau, si bien qu'un *job*, un consommateur ou un outil qui n'en nomme aucun est refusé
  (`NoCurrentTenantError`).
- Une personne appartient à un seul réseau. Le *realm* donne à chaque utilisateur un seul
  `tenant_id` (un attribut à une seule valeur), et les clés des tables restent `id` seul, unique
  entre les réseaux : des identifiants que l'application génère, et des sujets d'un seul *realm*
  pour les personnes. Un jeton dont le *claim* nomme plusieurs réseaux (`north,south`) n'en nomme
  aucun qui puisse exister et reçoit un 404 en bordure ; un sujet déjà enregistré dans un réseau
  qui s'enregistre dans un autre est refusé (409, `CONCURRENCY_CONFLICT`, la clé étant prise) et
  reste là où il était, si bien qu'aucune projection du second réseau ne le manque en silence.
  Une personne qui travaille pour deux réseaux a deux comptes. Servir un seul compte dans
  plusieurs réseaux ferait commencer chaque clé et chaque contrainte d'unicité par `tenant_id`
  (`(tenant_id, id)`), une migration de chaque table.
- Un réseau n'est servi que lorsqu'il est listé dans `NETWORKS`, l'annuaire pour lequel
  s'exécutent les *jobs* par réseau : un jeton ou un en-tête qui en nomme un autre reçoit un 404
  en bordure (`servedTenantOf`), pour qu'aucune donnée ne soit écrite là où aucun *job* ne
  s'exécuterait jamais.
- Les tuples de relation du modèle d'autorisation (`authorization.relation_tuples`) ne sont pas
  limités à un réseau : les éléments qu'ils nomment ont des identifiants uniques entre les
  réseaux, et chaque élément qu'un cas d'usage lit est limité par son *repository*. Les limiter
  aussi est l'étape suivante si un moteur d'autorisation partagé par plusieurs applications est
  introduit.

## Alternatives envisagées

- **Aucune multitenance.** L'application sert un seul client, et la frontière entre cabinets est
  le seul modèle d'autorisation. Refusé : ce que le propriétaire a demandé est une multitenance
  appliquée, mise en œuvre et testée sur l'exemple comme chaque règle du kit, et un second réseau
  laisserait l'isolement aux *specs* des gestionnaires.
- **Chaque cabinet un *tenant* sur des tables partagées.** Chaque instruction limitée à un
  cabinet. Refusé : la liste des rendez-vous d'un patient s'étend sur plusieurs cabinets, et un
  praticien de deux cabinets aurait besoin de deux sessions ; le modèle par relations décide déjà
  élément par élément ce qu'une frontière de *tenant* déciderait ligne par ligne.
- **La sécurité au niveau des lignes, ou un schéma ou une base par réseau.** Des lignes de
  défense plus fortes, câblées à la main aujourd'hui (`init` ne génère que des tables partagées).
  Les tables partagées suffisent pour quelques réseaux de taille semblable, et un passage
  ultérieur à la sécurité au niveau des lignes garde la même colonne.
