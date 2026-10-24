/// Whether an account may still act: a deactivated account keeps its history and signs in no more.
enum {{context.pascal}}AccountStatus {
  active
  deactivated

  @@map("account_status")
  @@schema("{{context.schema}}")
}

/// The role of a member in an organisation: what the member may do there follows from it.
enum {{context.pascal}}MemberRole {
  owner
  admin
  member

  @@map("member_role")
  @@schema("{{context.schema}}")
}

/// Where an invitation stands: pending until its person answers, or the organisation takes it back.
enum {{context.pascal}}InvitationStatus {
  pending
  accepted
  declined
  revoked

  @@map("invitation_status")
  @@schema("{{context.schema}}")
}

/// Keyed by the subject the identity provider gives the person. No password is stored.
model {{context.pascal}}Account {
  id            String                         @id
  email         String
  displayName   String                         @map("display_name")
  status        {{context.pascal}}AccountStatus
  provisionedAt DateTime                       @map("provisioned_at") @db.Timestamptz(3)
  deactivatedAt DateTime?                      @map("deactivated_at") @db.Timestamptz(3)
  version       Int
  createdAt     DateTime                       @map("created_at") @db.Timestamptz(3)
  createdBy     String                         @map("created_by")
  updatedAt     DateTime                       @map("updated_at") @db.Timestamptz(3)
  updatedBy     String                         @map("updated_by")

  @@map("accounts")
  @@schema("{{context.schema}}")
}

/// Keyed by the slug, which is also the tenant id when the project has tenants.
model {{context.pascal}}Organisation {
  id        String   @id
  name      String
  openedBy  String   @map("opened_by")
  openedAt  DateTime @map("opened_at") @db.Timestamptz(3)
  version   Int
  createdAt DateTime @map("created_at") @db.Timestamptz(3)
  createdBy String   @map("created_by")
  updatedAt DateTime @map("updated_at") @db.Timestamptz(3)
  updatedBy String   @map("updated_by")

  @@map("organisations")
  @@schema("{{context.schema}}")
}

/// One current membership per account and organisation: the partial unique index is the guard.
model {{context.pascal}}Member {
  id             String                      @id
  organisationId String                      @map("organisation_id")
  accountId      String                      @map("account_id")
  role           {{context.pascal}}MemberRole
  joinedAt       DateTime                    @map("joined_at") @db.Timestamptz(3)
  removedAt      DateTime?                   @map("removed_at") @db.Timestamptz(3)
  version        Int
  createdAt      DateTime                    @map("created_at") @db.Timestamptz(3)
  createdBy      String                      @map("created_by")
  updatedAt      DateTime                    @map("updated_at") @db.Timestamptz(3)
  updatedBy      String                      @map("updated_by")

  @@unique([organisationId, accountId], map: "members_current_idx", where: { removedAt: null })
  @@index([accountId], map: "members_account_idx")
  @@map("members")
  @@schema("{{context.schema}}")
}

model {{context.pascal}}Invitation {
  id             String                            @id
  organisationId String                            @map("organisation_id")
  email          String
  role           {{context.pascal}}MemberRole
  tokenHash      String                            @unique @map("token_hash")
  invitedBy      String                            @map("invited_by")
  issuedAt       DateTime                          @map("issued_at") @db.Timestamptz(3)
  expiresAt      DateTime                          @map("expires_at") @db.Timestamptz(3)
  status         {{context.pascal}}InvitationStatus
  answeredAt     DateTime?                         @map("answered_at") @db.Timestamptz(3)
  version        Int
  createdAt      DateTime                          @map("created_at") @db.Timestamptz(3)
  createdBy      String                            @map("created_by")
  updatedAt      DateTime                          @map("updated_at") @db.Timestamptz(3)
  updatedBy      String                            @map("updated_by")

  @@index([organisationId, status], map: "invitations_organisation_idx")
  @@map("invitations")
  @@schema("{{context.schema}}")
}

model {{context.pascal}}Delegation {
  id             String    @id
  organisationId String    @map("organisation_id")
  delegatorId    String    @map("delegator_id")
  delegateId     String    @map("delegate_id")
  /// The rights lent, separated by commas: a right is a word of `MemberRight`, which holds none.
  rights         String
  startsAt       DateTime  @map("starts_at") @db.Timestamptz(3)
  endsAt         DateTime  @map("ends_at") @db.Timestamptz(3)
  endedAt        DateTime? @map("ended_at") @db.Timestamptz(3)
  version        Int
  createdAt      DateTime  @map("created_at") @db.Timestamptz(3)
  createdBy      String    @map("created_by")
  updatedAt      DateTime  @map("updated_at") @db.Timestamptz(3)
  updatedBy      String    @map("updated_by")

  @@index([organisationId, delegateId], map: "delegations_delegate_idx")
  @@index([organisationId, delegatorId], map: "delegations_delegator_idx")
  @@map("delegations")
  @@schema("{{context.schema}}")
}
