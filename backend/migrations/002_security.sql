-- Token version: signing out or changing the password bumps it, which revokes
-- every login token issued before (tokens carry the version they were issued with).
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Emails are compared in lower case everywhere; keep stored addresses within the RFC limit.
ALTER TABLE users ADD CONSTRAINT users_email_length CHECK (char_length(email) <= 254) NOT VALID;

-- Daily caps count today's activities of one kind for one person.
CREATE INDEX IF NOT EXISTS activities_user_kind_time ON activities (user_id, kind, created_at DESC);
