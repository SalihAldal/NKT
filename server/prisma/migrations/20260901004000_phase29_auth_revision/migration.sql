-- Phase 29 auth revision: username/password/birthDate/recovery

ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'USERNAME';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "birth_date" DATE;

ALTER TABLE "user_profiles"
  ADD COLUMN IF NOT EXISTS "username_normalized" TEXT;

UPDATE "user_profiles"
SET "username_normalized" = lower(trim("username"))
WHERE "username_normalized" IS NULL;

ALTER TABLE "auth_identities"
  ADD COLUMN IF NOT EXISTS "username_normalized" TEXT,
  ADD COLUMN IF NOT EXISTS "recovery_code_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "recovery_code_updated_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_username_normalized_key"
  ON "user_profiles"("username_normalized");

CREATE INDEX IF NOT EXISTS "user_profiles_username_normalized_idx"
  ON "user_profiles"("username_normalized");

CREATE UNIQUE INDEX IF NOT EXISTS "auth_identities_provider_username_normalized_key"
  ON "auth_identities"("provider", "username_normalized");
