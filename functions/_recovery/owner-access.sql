CREATE TABLE IF NOT EXISTS recovery_owner_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  code_mac TEXT NOT NULL,
  ip_mac TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS recovery_owner_challenges_email_created ON recovery_owner_challenges(email, created_at);
CREATE INDEX IF NOT EXISTS recovery_owner_challenges_ip_created ON recovery_owner_challenges(ip_mac, created_at);
CREATE TABLE IF NOT EXISTS recovery_owner_sessions (
  session_hash TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS recovery_owner_sessions_email ON recovery_owner_sessions(email);
CREATE INDEX IF NOT EXISTS recovery_owner_sessions_expires ON recovery_owner_sessions(expires_at);
