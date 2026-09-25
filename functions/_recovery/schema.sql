-- Dedicated recovery-tag database only. No owner data or production tokens belong here.
CREATE TABLE owners (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  show_name INTEGER NOT NULL DEFAULT 0 CHECK (show_name IN (0, 1)),
  allow_call INTEGER NOT NULL DEFAULT 0 CHECK (allow_call IN (0, 1)),
  allow_text INTEGER NOT NULL DEFAULT 0 CHECK (allow_text IN (0, 1)),
  allow_email INTEGER NOT NULL DEFAULT 0 CHECK (allow_email IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE recovery_tags (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT REFERENCES owners(id) ON DELETE RESTRICT,
  public_token TEXT COLLATE BINARY NOT NULL UNIQUE
    CHECK (length(public_token) = 32 AND public_token NOT GLOB '*[^A-Za-z0-9_-]*'),
  item_label TEXT,
  status TEXT NOT NULL DEFAULT 'unclaimed'
    CHECK (status IN ('unclaimed', 'active', 'inactive', 'replaced')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (status != 'active' OR owner_id IS NOT NULL),
  CHECK (status != 'unclaimed' OR owner_id IS NULL)
);

CREATE INDEX recovery_tags_owner_id ON recovery_tags(owner_id);

CREATE TRIGGER recovery_tag_token_immutable
BEFORE UPDATE OF public_token ON recovery_tags
WHEN NEW.public_token != OLD.public_token
BEGIN
  SELECT RAISE(ABORT, 'Recovery tokens are permanent');
END;


CREATE TABLE IF NOT EXISTS recovery_activation_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  tag_id TEXT NOT NULL REFERENCES recovery_tags(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_mac TEXT NOT NULL,
  ip_mac TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  session_hash TEXT,
  session_expires_at TEXT,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS recovery_activation_tag_created ON recovery_activation_challenges(tag_id, created_at);
CREATE INDEX IF NOT EXISTS recovery_activation_email_created ON recovery_activation_challenges(email, created_at);
CREATE INDEX IF NOT EXISTS recovery_activation_ip_created ON recovery_activation_challenges(ip_mac, created_at);

CREATE TABLE IF NOT EXISTS recovery_tag_claims (
  tag_id TEXT PRIMARY KEY NOT NULL REFERENCES recovery_tags(id) ON DELETE RESTRICT,
  owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  claimed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
