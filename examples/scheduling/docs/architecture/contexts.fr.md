[English](contexts.md) · **Français**
<!-- translation-of: contexts.md sha256:6a701a2d1ebe942d -->

# Contextes délimités

| Contexte | Classification | Raison d'être (deux phrases, termes métier) | Possède (événements de la frise) | Propriétaire |
|---|---|---|---|---|
| identity | de soutien | Connaît les personnes, les cabinets où elles travaillent et ce qu'un praticien a délégué à un assistant. Il dit qui est qui ; il ne dit jamais ce qui se passe sur un calendrier. | 1 à 7 | exploitation de la plateforme |
| scheduling | cœur | Publie les disponibilités des calendriers et y prend des rendez-vous, de la réservation à la fin. Il garantit qu'un temps sur un calendrier n'est occupé qu'une fois. | 8 à 23 | cabinets (produit) |
| notification | de soutien | Dit aux gens ce qui est arrivé à leurs rendez-vous et le leur rappelle avant le début. Il ne décide rien sur un rendez-vous. | 24, 25 | relations patients |
| analytics | de soutien | Mesure l'occupation, les annulations et les absences de chaque calendrier, par jour. Il ne fait que lire ce qu'annoncent les autres contextes. | 26, 27 | responsables de cabinet |

Le journal d'audit (lignes 28 et 29) n'est pas un contexte : voir « Découpages rejetés ».

## Pourquoi ces frontières

- identity / scheduling : « praticien » est un membre avec un rôle pour identity et le propriétaire de calendriers pour scheduling ; « patient » est n'importe quelle personne pour identity et celle pour qui est un rendez-vous dans scheduling (langage). Les règles d'adhésion et de délégation changent sans qu'un calendrier s'en aperçoive (autonomie).
- scheduling / notification : la politique « chaque fois qu'un rendez-vous est réservé, prévenir le patient » relie un événement à une commande entre deux propriétaires ; un fournisseur de courriel en panne ne doit jamais refuser une réservation (autonomie, et le système externe a son propre modèle).
- scheduling / analytics : « annulation » est une fin de rendez-vous avec une partie et une raison dans scheduling, un nombre par jour dans analytics (langage) ; analytics ne décide rien et peut avoir du retard (cohérence : la cohérence à terme est acceptée et dite).
- scheduling garde la liste d'attente : une offre occupe un temps sur un calendrier, ce qui doit être vrai au même instant que les rendez-vous (cohérence).
- identity garde les délégations : une délégation lie deux membres d'un même cabinet et prend fin quand l'un d'eux le quitte (cohérence avec l'adhésion) ; scheduling ne la copie pas, le modèle d'autorisation la lit.

## Découpages rejetés

- Un contexte `availability` séparé, à côté de `booking` : un créneau est valide au regard des horaires d'ouverture, des indisponibilités et des rendez-vous au même instant ; deux contextes demanderaient une vérification distribuée. À reconsidérer si les disponibilités sont un jour vendues à d'autres produits.
- Un contexte `waitlist` séparé : ses offres occupent du temps de calendrier ; gardé dans scheduling comme agrégat à part entière.
- Un contexte `audit` : le journal d'audit enregistre autour de chaque cas d'usage de chaque contexte, sans langage propre ni décision ; c'est une capacité de la plateforme (`src/platform/audit/`), lue par une seule route protégée. Il deviendrait un contexte le jour où les auditeurs auraient leurs propres cas d'usage (conservations légales, exports avec un circuit de validation).
- Un niveau `organization` au-dessus du cabinet : absent des besoins (point chaud) ; le cabinet est l'unité gardée à part.
- Un contexte `reminder` : un rappel est une sorte de notification avec une heure d'échéance ; gardé dans notification.
