[English](0004-attendance-records-wait-for-a-tenant-in-the-event-store.md) · **Français**
<!-- translation-of: 0004-attendance-records-wait-for-a-tenant-in-the-event-store.md sha256:25418a644144942e -->

# ADR-0004 : les relevés de présence attendent un *tenant* dans l'*event store*

- Statut : accepté
- Date : 2026-10-13

## Contexte

L'ADR-0003 met le réseau de chaque ligne dans une colonne `tenant_id` et limite chaque
instruction d'un *repository* au réseau du travail. Le relevé de présence d'un patient est arrivé
ensuite, comme premier agrégat de l'application gardé sous forme d'événements : ses événements,
ses *snapshots*, les points de reprise des abonnements qui alimentent les projections et les clés
de ses données personnelles vivent dans les tables de l'*event store* du kit (`stored_events`,
`stored_events_head`, `stream_snapshots`, `subscription_checkpoints`, `subject_keys`), et son
historique dans le modèle de lecture `attendance_history`, écrit par une projection qu'alimente ce
registre.

L'*event store* du kit n'enregistre aucun *tenant* : un événement ajouté porte son flux, sa
version et son agrégat, pas le réseau du travail, et un abonnement rejoue les événements de chaque
flux dans aucun réseau. Une projection qu'il alimente ne peut pas savoir à quel réseau appartient
une ligne de `attendance_history`.

## Décision

Tant que l'*event store* ne garde pas le *tenant* de chaque événement, les relevés de présence
restent en dehors des réseaux :

- les cinq tables de l'*event store* et `attendance_history` n'ont pas de colonne `tenant_id`, et
  la migration de l'ADR-0003 n'en ajoute pas ;
- `KnexAttendanceHistory` lit sa table sans l'option de *tenant*, sous une désactivation de
  `tenancy/scoped-statement` qui nomme cet enregistrement.

Ce qui les limite encore : un relevé est celui d'un cabinet et d'un patient
(`AttendanceRecord.idOf(practiceId, patientId)`), un cabinet appartient à un seul réseau, et les
deux cas d'usage demandent l'appartenance à ce cabinet avant que rien ne soit lu ni noté
(ADR-0001). Un appelant d'un autre réseau est refusé par le modèle d'autorisation, pas par le
stockage.

## Conséquences

- Une instruction écrite à la main contre ces tables atteindrait chaque réseau : la revue d'un
  changement qui les touche vérifie l'identifiant de relevé qu'il lit.
- `keep-the-network-of-every-row.spec.ts` nomme les six tables comme les exceptions.

## Condition pour le retirer

L'*event store* du kit estampille le *tenant* du travail sur chaque événement (ses métadonnées ou
une colonne), rejoue un abonnement dans le *tenant* de chaque événement, et ses tables prennent
`tenantColumn` : alors les six tables reçoivent le réseau, le modèle de lecture prend `tenant`, et
cet enregistrement est remplacé.
