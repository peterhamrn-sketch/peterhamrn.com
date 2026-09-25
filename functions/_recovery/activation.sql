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