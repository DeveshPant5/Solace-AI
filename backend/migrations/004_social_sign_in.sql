-- Sign in with Google or Apple. Accounts made that way have no password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- One row per linked Google or Apple account. `subject` is the provider's stable
-- user id (the ID token's `sub`), which never changes even if the email does.
CREATE TABLE IF NOT EXISTS user_identities (
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 255),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The email the provider reported when the account was linked (Apple's may be a relay address).
  email TEXT CHECK (char_length(email) <= 254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS user_identities_user ON user_identities (user_id);
